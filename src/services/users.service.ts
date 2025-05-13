import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import * as argon2 from 'argon2'
import { Repository } from 'typeorm'
import { CreateUserDto } from '../dto/create-user.dto'
import { User } from '../entities/user.entity'
import { EthereumService } from './ethereum.service'
import { SubstrateService } from './substrate.service'
import { VaultService } from './vault.service'

/**
 * Data returned from Google OAuth.
 */
interface GoogleUserData {
  /** Unique Google user ID */
  googleId: string
  /** User's email address */
  email: string
  /** User's display name */
  displayName: string
}

/**
 * Authenticated user data returned by the service.
 */
interface AuthenticatedUser {
  /** User's unique system ID */
  id: string
  /** User's email */
  email: string
  /** Linked Google ID, if any */
  googleId: string | null
  /** Display name, if any */
  displayName: string | null
  /** User's Ethereum public address */
  publicKey: string | null
}

/**
 * Service responsible for user management including registration,
 * authentication, and Ethereum wallet operations.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)
  private readonly ethereumService: EthereumService
  private readonly substrateService: SubstrateService

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly vaultService: VaultService,
    private readonly configService: ConfigService,
    ethereumService: EthereumService,
    substrateService: SubstrateService
  ) {
    this.ethereumService = ethereumService
    this.substrateService = substrateService
  }

  /**
   * Registers a new user, hashes their password, generates an Ethereum or Substrate wallet,
   * and stores the private key in the Vault.
   * @param createUserDto - DTO containing email and password
   * @param chain - The blockchain type ('ethereum' or 'substrate')
   * @returns Object with user id, email, and publicKey
   * @throws ConflictException if user already exists
   * @throws InternalServerErrorException on vault or DB errors
   */
  async registerUser(
    dto: CreateUserDto,
    chain: 'ethereum' | 'substrate' = 'ethereum'
  ): Promise<{
    id: string
    email: string
    publicKey: string | null
    substratePublicKey: string | null
  }> {
    const queryRunner = this.userRepository.manager.connection.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      // Check existing user
      const existing = await queryRunner.manager.findOne(User, { where: { email: dto.email } })
      if (existing) {
        throw new ConflictException(`User with email ${dto.email} already exists`)
      }

      // Hash password and create user
      const hashed = await argon2.hash(dto.password)
      const user = queryRunner.manager.create(User, { email: dto.email, password: hashed })
      await queryRunner.manager.save(user)

      let ethAddr: string | null = null
      let subAddr: string | null = null

      try {
        if (chain === 'substrate') {
          const { address, privateKey } = await this.substrateService.generateWallet(user.id)
          subAddr = address
          user.substratePublicKey = address
          await this.vaultService.storeSecret(`substrate/${user.id}`, { privateKey })
        } else {
          const { address, privateKey } = await this.ethereumService.generateWallet(user.id)
          ethAddr = address
          user.publicKey = address
          await this.vaultService.storeSecret(`ethereum/${user.id}`, { privateKey })
        }

        // Update user with wallet info
        await queryRunner.manager.save(user)
        await queryRunner.commitTransaction()

        return {
          id: user.id,
          email: user.email,
          publicKey: ethAddr,
          substratePublicKey: subAddr,
        }
      } catch (_error) {
        // If Vault storage fails, rollback DB changes
        await queryRunner.rollbackTransaction()
        throw new InternalServerErrorException('Failed to setup user wallet')
      }
    } catch (error) {
      await queryRunner.rollbackTransaction()
      if (error instanceof ConflictException) {
        throw error
      }
      throw new InternalServerErrorException('Failed to create user')
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * Finds a user by email.
   * @param email - Email address to search
   * @returns User entity or null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } })
  }

  /**
   * Finds a user by system ID.
   * @param id - User UUID
   * @returns User entity or null
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } })
  }

  /**
   * Validates user credentials by comparing hashed password.
   * @param email - User's email
   * @param password - Plain text password to verify
   * @returns User entity if valid, otherwise undefined
   */
  async validateUser(email: string, password: string): Promise<User | undefined> {
    const user = await this.findByEmail(email)
    if (user && user.password && (await argon2.verify(user.password, password))) {
      return user
    }
    return undefined
  }

  /**
   * Sends native Ethereum tokens from a user's wallet to another address.
   * @param email - Sender's email
   * @param toAddress - Recipient's Ethereum address
   * @param amount - Amount to send (in ETH)
   * @returns Transaction hash object
   * @throws InternalServerErrorException if EthereumService not initialized
   * @throws BadRequestException if user not found
   */
  async sendTokensFromUser(
    email: string,
    toAddress: string,
    amount: string
  ): Promise<{ hash: string }> {
    // Check if EthereumService is set
    if (!this.ethereumService) {
      this.logger.error('EthereumService not initialized')
      throw new InternalServerErrorException('EthereumService not initialized')
    }

    // Find user
    const user = await this.findByEmail(email)
    if (!user) {
      this.logger.warn(`User ${email} not found`)
      throw new BadRequestException(`User ${email} not found`)
    }

    // Send transaction
    const isOAuth = !!user.googleId
    const { hash } = await this.ethereumService.sendNative(email, toAddress, amount, isOAuth)
    return { hash }
  }

  /**
   * Finds or creates a user based on Google OAuth data.
   * @param userData - Data returned from Google OAuth
   * @param chain - The blockchain type ('ethereum' or 'substrate')
   * @returns AuthenticatedUser details
   * @throws BadRequestException for incomplete data or user not found
   * @throws InternalServerErrorException on vault or DB errors
   */
  async findOrCreateFromGoogle(
    userData: GoogleUserData,
    chain: 'ethereum' | 'substrate' = 'substrate'
  ): Promise<AuthenticatedUser> {
    const queryRunner = this.userRepository.manager.connection.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      let user =
        (await queryRunner.manager.findOne(User, { where: { googleId: userData.googleId } })) ??
        (await queryRunner.manager.findOne(User, { where: { email: userData.email } }))

      let isNewUser = false
      if (!user) {
        this.logger.log(`Creating new OAuth user ${userData.email}`)
        user = queryRunner.manager.create(User, {
          email: userData.email,
          displayName: userData.displayName,
          googleId: userData.googleId,
        })
        await queryRunner.manager.save(user)
        isNewUser = true
      } else if (!user.googleId) {
        this.logger.log(
          `Linking existing account ${userData.email} with Google ID ${userData.googleId}`
        )
        user.googleId = userData.googleId
        user.displayName = user.displayName || userData.displayName
        await queryRunner.manager.save(user)
      }

      // Check if wallet generation is needed
      const needSubstrateWallet = chain === 'substrate' && !user.substratePublicKey
      const needEthereumWallet = chain === 'ethereum' && !user.publicKey

      if (isNewUser || needSubstrateWallet || needEthereumWallet) {
        try {
          this.logger.log(`Generating ${chain} wallet for user ${user.email} (ID: ${user.id})`)

          if (chain === 'substrate') {
            const existingSecret = await this.vaultService.getSecret(`substrate/${user.id}`)

            if (!existingSecret || !existingSecret.privateKey) {
              this.logger.log(`Generating new substrate wallet for ${user.email}`)
              const { address, privateKey } = await this.substrateService.generateWallet(user.id)
              user.substratePublicKey = address
              await this.vaultService.storeSecret(`substrate/${user.id}`, { privateKey })
              await queryRunner.manager.save(user)
              this.logger.log(`Generated substrate wallet with address: ${address}`)
            } else {
              this.logger.log(`Found existing substrate wallet for ${user.email}`)
              if (!user.substratePublicKey) {
                const { address } = await this.substrateService.generateWallet(user.id)
                user.substratePublicKey = address
                await queryRunner.manager.save(user)
                this.logger.log(`Updated substrate address: ${address}`)
              }
            }
          } else {
            const existingSecret = await this.vaultService.getSecret(`ethereum/${user.id}`)
            if (!existingSecret || !existingSecret.privateKey) {
              this.logger.log(`Generating new ethereum wallet for ${user.email}`)
              const { address, privateKey } = await this.ethereumService.generateWallet(user.id)
              user.publicKey = address
              await this.vaultService.storeSecret(`ethereum/${user.id}`, { privateKey })
              await queryRunner.manager.save(user)
              this.logger.log(`Generated ethereum wallet with address: ${address}`)
            } else {
              this.logger.log(`Found existing ethereum wallet for ${user.email}`)
            }
          }

          await queryRunner.commitTransaction()
        } catch (_error) {
          await queryRunner.rollbackTransaction()
          this.logger.error('Failed to generate wallet')
          throw new InternalServerErrorException('Failed to setup user wallet')
        }
      } else {
        await queryRunner.commitTransaction()
      }

      const unifiedKey = user.substratePublicKey ?? user.publicKey
      return {
        id: user.id,
        email: user.email,
        googleId: user.googleId!,
        displayName: user.displayName!,
        publicKey: unifiedKey!,
      }
    } catch (_error) {
      await queryRunner.rollbackTransaction()
      throw new InternalServerErrorException('Failed to process Google authentication')
    } finally {
      await queryRunner.release()
    }
  }
}
