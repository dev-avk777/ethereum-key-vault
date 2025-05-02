import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { CreateUserDto } from '../dto/create-user.dto'
import { VaultService } from './vault.service'
import { Wallet } from 'ethers'
import * as argon2 from 'argon2'
import { encodeAddress } from '@polkadot/util-crypto'
import { EthereumService } from './ethereum.service'
import { ConfigService } from '@nestjs/config'
import { IWalletService } from './wallet.interface'

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
  publicKey: string
}

/**
 * Service responsible for user management including registration,
 * authentication, and Ethereum wallet operations.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)
  private ethereumService: EthereumService | null = null

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly vaultService: VaultService,
    private readonly configService: ConfigService,
    @Inject('WalletService')
    private readonly wallet: IWalletService
  ) {}

  /**
   * Injects the EthereumService instance for blockchain operations.
   * @param service - Initialized EthereumService
   */
  setEthereumService(service: EthereumService) {
    this.ethereumService = service
  }

  /**
   * Registers a new user, hashes their password, generates an Ethereum wallet,
   * and stores the private key in the Vault.
   * @param createUserDto - DTO containing email and password
   * @returns Object with user id, email, and publicKey
   * @throws ConflictException if user already exists
   * @throws InternalServerErrorException on vault or DB errors
   */
  async registerUser(
    dto: CreateUserDto
  ): Promise<{ id: string; email: string; publicKey: string }> {
    const { email, password } = dto

    // Check if user exists
    const existingUser = await this.userRepository.findOne({ where: { email } })
    if (existingUser) {
      throw new ConflictException(`User with email ${email} already exists`)
    }

    // Hash password
    const hashedPassword = await argon2.hash(password)

    try {
      // Generate wallet using email
      const { address: publicKey, privateKey } = await this.wallet.generateWallet(email)

      // Create user entity
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        publicKey,
      })

      // Save user to database
      await this.userRepository.save(user)

      // Store private key in Vault
      await this.vaultService.storeSecret(`ethereum/${user.id}`, {
        privateKey,
      })

      this.logger.log(`Registered user ${email}`)
      return { id: user.id, email: user.email, publicKey }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to register user ${email}: ${errorMessage}`)
      throw new InternalServerErrorException(`Failed to register user: ${errorMessage}`)
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
   * Converts an Ethereum address to a Substrate-compatible address.
   * @param ethAddress - Ethereum address (0x...)
   * @returns Substrate-formatted address
   * @throws BadRequestException if address is invalid
   */
  async convertToSubstrateAddress(ethAddress: string): Promise<string> {
    if (!ethAddress || !ethAddress.startsWith('0x')) {
      throw new BadRequestException('Invalid Ethereum address')
    }
    const ethAddressBytes = Buffer.from(ethAddress.slice(2), 'hex')
    return encodeAddress(ethAddressBytes, 42)
  }

  /**
   * Retrieves the Substrate address for a user by their email.
   * @param email - User's email
   * @returns Substrate-compatible address
   * @throws BadRequestException if user not found
   */
  async getSubstrateAddress(email: string): Promise<string> {
    const user = await this.findByEmail(email)
    if (!user) {
      throw new BadRequestException(`User ${email} not found`)
    }
    return this.convertToSubstrateAddress(user.publicKey)
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
   * @returns AuthenticatedUser details
   * @throws BadRequestException for incomplete data or user not found
   * @throws InternalServerErrorException on vault or DB errors
   */
  async findOrCreateFromGoogle(userData: GoogleUserData): Promise<AuthenticatedUser> {
    if (!userData.googleId || !userData.email) {
      this.logger.error('Incomplete user data from Google OAuth')
      throw new BadRequestException('Incomplete user data for OAuth authentication')
    }
    try {
      let user = await this.userRepository.findOne({ where: { googleId: userData.googleId } })
      if (!user && userData.email) {
        user = await this.findByEmail(userData.email)
      }
      if (!user) {
        this.logger.log(`Creating new user from Google OAuth: ${userData.email}`)
        this.logger.debug(`[Wallet] Generating Ethereum wallet for ${userData.email}`)
        const wallet = Wallet.createRandom()
        const privateKey = wallet.privateKey
        const publicKey = wallet.address
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(`[Wallet] Generated wallet address: ${wallet.address}`)
          this.logger.debug(`[Wallet] Private key: ${wallet.privateKey} (to be stored in Vault)`)
        }
        try {
          user = this.userRepository.create({
            email: userData.email,
            displayName: userData.displayName,
            googleId: userData.googleId,
            publicKey,
          })
          await this.userRepository.save(user)

          const vaultPath = `ethereum/${user.id}`
          await this.vaultService.storeSecret(vaultPath, { privateKey })

          this.logger.log(`Created new user from Google OAuth: ${userData.email}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          this.logger.error(
            `Failed to store private key in Vault for user ${userData.email}: ${errorMessage}`
          )
          throw new InternalServerErrorException('Failed to create user account')
        }
      } else if (!user.googleId) {
        this.logger.log(`Linking existing user ${userData.email} with Google account`)
        user.googleId = userData.googleId
        user.displayName = userData.displayName
        await this.userRepository.save(user)
      }
      return {
        id: user.id,
        email: user.email,
        googleId: user.googleId,
        displayName: user.displayName,
        publicKey: user.publicKey,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Error in findOrCreateFromGoogle: ${errorMessage}`)
      throw error instanceof BadRequestException || error instanceof InternalServerErrorException
        ? error
        : new InternalServerErrorException(`Authentication failed: ${errorMessage}`)
    }
  }
}
