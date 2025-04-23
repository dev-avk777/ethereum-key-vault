import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { CreateUserDto } from '../dto/create-user.dto'
import { VaultService } from './vault.service'
import { Wallet } from 'ethers'
import * as argon2 from 'argon2'

// Interface for user data received from Google
interface GoogleUserData {
  googleId: string
  email: string
  displayName: string
}

// Interface for typed user returned by UsersService
interface AuthenticatedUser {
  id: string
  email: string
  googleId: string | null
  displayName: string | null
  publicKey: string
}

/**
 * UsersService contains logic for user registration, Ethereum wallet generation,
 * storing private keys in Vault and public keys in the database.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly vaultService: VaultService
  ) {}

  /**
   * Registers a new user:
   * 1. Hashes the password using argon2.
   * 2. Generates a new Ethereum wallet.
   * 3. Stores the private key in Vault.
   * 4. Saves the user with email, hashed password, and public key in PostgreSQL.
   *
   * @param createUserDto - Registration data (email and password).
   * @returns Object with user data (without password).
   */
  async registerUser(
    createUserDto: CreateUserDto
  ): Promise<{ id: string; email: string; publicKey: string }> {
    const { email, password } = createUserDto

    // Password hashing using argon2 for secure storage
    const hashedPassword = await argon2.hash(password)
    this.logger.debug(`[Wallet] Generating Ethereum wallet for ${email}`)

    // Generate a new Ethereum wallet
    const wallet = Wallet.createRandom()
    const privateKey = wallet.privateKey
    const publicKey = wallet.address
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[Wallet] Generated wallet address: ${wallet.address}`)
      this.logger.debug(`[Wallet] Private key: ${wallet.privateKey} (to be stored in Vault)`)
    }
    try {
      // Store private key in Vault
      const vaultPath = `secret/ethereum/${email}`
      await this.vaultService.storeSecret(vaultPath, { privateKey })

      // Create user instance and save to PostgreSQL database
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        publicKey,
      })

      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `[Users] Saving user to DB: ${JSON.stringify({
            email: user.email,
            publicKey: user.publicKey,
          })}`
        )
      }

      await this.userRepository.save(user)

      this.logger.log(`Registered user ${email} with public Ethereum address ${publicKey}`)

      // Return user data (without password)
      return { id: user.id, email: user.email, publicKey: user.publicKey }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to register user ${email}: ${errorMessage}`)
      throw new InternalServerErrorException(`Failed to register user: ${errorMessage}`)
    }
  }

  /**
   * Finds a user by email.
   * @param email - User's email.
   * @returns User object or null if not found.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } })
  }

  /**
   * Finds a user by ID.
   * @param id - User's ID.
   * @returns User object or null if not found.
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } })
  }

  /**
   * Validates a user by email and password.
   * Compares the provided password with the hashed one in the database.
   * @param email - User's email.
   * @param password - Password to verify.
   * @returns User object if verification passes, or undefined otherwise.
   */
  async validateUser(email: string, password: string): Promise<User | undefined> {
    const user = await this.findByEmail(email)
    if (user && user.password && (await argon2.verify(user.password, password))) {
      return user
    }
    return undefined
  }

  /**
   * Finds a user by Google ID or creates a new user.
   * For new users, an Ethereum wallet is generated.
   * @param userData - User data from Google OAuth
   * @returns User object
   */
  async findOrCreateFromGoogle(userData: GoogleUserData): Promise<AuthenticatedUser> {
    if (!userData.googleId || !userData.email) {
      this.logger.error('Incomplete user data from Google OAuth')
      throw new Error('Incomplete user data for OAuth authentication')
    }

    try {
      // Look for user by Google ID
      let user = await this.userRepository.findOne({
        where: { googleId: userData.googleId },
      })

      // If user not found by Google ID, check by email
      if (!user && userData.email) {
        user = await this.findByEmail(userData.email)
      }

      // If user not found, create a new one
      if (!user) {
        this.logger.log(`Creating new user from Google OAuth: ${userData.email}`)
        this.logger.debug(`[Wallet] Generating Ethereum wallet for ${userData.email}`)

        // Generate Ethereum wallet
        const wallet = Wallet.createRandom()
        const privateKey = wallet.privateKey
        const publicKey = wallet.address
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(`[Wallet] Generated wallet address: ${wallet.address}`)
          this.logger.debug(`[Wallet] Private key: ${wallet.privateKey} (to be stored in Vault)`)
        }
        try {
          // Store private key in Vault
          const vaultPath = `secret/ethereum/oauth_${userData.email}`
          await this.vaultService.storeSecret(vaultPath, { privateKey })

          // Create a new user
          user = this.userRepository.create({
            email: userData.email,
            displayName: userData.displayName,
            googleId: userData.googleId,
            publicKey: publicKey,
          })

          await this.userRepository.save(user)
          this.logger.log(
            `Created new user from Google OAuth: ${userData.email} with publicKey: ${publicKey}`
          )
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          this.logger.error(
            `Failed to store private key in Vault for user ${userData.email}: ${errorMessage}`
          )
          throw new InternalServerErrorException('Failed to create user account')
        }
      } else if (!user.googleId) {
        // If user found by email but has no Google ID,
        // update user data
        this.logger.log(`Linking existing user ${userData.email} with Google account`)
        user.googleId = userData.googleId
        user.displayName = userData.displayName
        await this.userRepository.save(user)
      }

      // Convert User to AuthenticatedUser
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
      throw error instanceof InternalServerErrorException
        ? error
        : new InternalServerErrorException(`Authentication failed: ${errorMessage}`)
    }
  }
}
