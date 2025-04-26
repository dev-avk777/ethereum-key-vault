import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  ConflictException,
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

interface GoogleUserData {
  googleId: string
  email: string
  displayName: string
}

interface AuthenticatedUser {
  id: string
  email: string
  googleId: string | null
  displayName: string | null
  publicKey: string
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)
  private ethereumService: EthereumService | null = null

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly vaultService: VaultService
  ) {}

  setEthereumService(service: EthereumService) {
    this.ethereumService = service
  }

  async registerUser(
    createUserDto: CreateUserDto
  ): Promise<{ id: string; email: string; publicKey: string }> {
    const { email, password } = createUserDto
    const existingUser = await this.findByEmail(email)
    if (existingUser) {
      this.logger.warn(`[Users] User with email ${email} already exists`)
      throw new ConflictException(`User with email ${email} already exists`)
    }

    const hashedPassword = await argon2.hash(password)
    this.logger.debug(`[Wallet] Generating Ethereum wallet for ${email}`)
    const wallet = Wallet.createRandom()
    const privateKey = wallet.privateKey
    const publicKey = wallet.address
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[Wallet] Generated wallet address: ${wallet.address}`)
      this.logger.debug(`[Wallet] Private key: ${wallet.privateKey} (to be stored in Vault)`)
    }
    try {
      const vaultPath = `secret/ethereum/${email}`
      await this.vaultService.storeSecret(vaultPath, { privateKey })
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        publicKey,
      })
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`[Users] Saving user to DB: ${JSON.stringify({ email: user.email })}`)
      }
      await this.userRepository.save(user)
      this.logger.log(`Registered user ${email}`)
      return { id: user.id, email: user.email, publicKey: user.publicKey }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to register user ${email}: ${errorMessage}`)
      throw new InternalServerErrorException(`Failed to register user: ${errorMessage}`)
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } })
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } })
  }

  async validateUser(email: string, password: string): Promise<User | undefined> {
    const user = await this.findByEmail(email)
    if (user && user.password && (await argon2.verify(user.password, password))) {
      return user
    }
    return undefined
  }

  async convertToSubstrateAddress(ethAddress: string): Promise<string> {
    if (!ethAddress || !ethAddress.startsWith('0x')) {
      throw new BadRequestException('Invalid Ethereum address')
    }
    const ethAddressBytes = Buffer.from(ethAddress.slice(2), 'hex')
    return encodeAddress(ethAddressBytes, 42)
  }

  async getSubstrateAddress(email: string): Promise<string> {
    const user = await this.findByEmail(email)
    if (!user) {
      throw new BadRequestException(`User ${email} not found`)
    }
    return this.convertToSubstrateAddress(user.publicKey)
  }

  async sendTokensFromUser(
    email: string,
    toAddress: string,
    amount: string,
    _isOAuth: boolean = false
  ) {
    if (!this.ethereumService) {
      this.logger.error('EthereumService not initialized')
      throw new InternalServerErrorException('EthereumService not initialized')
    }
    const user = await this.findByEmail(email)
    if (!user) {
      this.logger.warn(`User ${email} not found`)
      throw new BadRequestException(`User ${email} not found`)
    }
    const tx = await this.ethereumService.sendNative(email, toAddress, amount, _isOAuth)
    return { hash: tx.hash }
  }

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
          const vaultPath = `secret/ethereum/${userData.email}`
          await this.vaultService.storeSecret(vaultPath, { privateKey })
          user = this.userRepository.create({
            email: userData.email,
            displayName: userData.displayName,
            googleId: userData.googleId,
            publicKey,
          })
          await this.userRepository.save(user)
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
