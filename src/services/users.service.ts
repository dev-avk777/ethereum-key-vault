import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { encodeAddress } from '@polkadot/util-crypto'
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
    // 1) Проверка и хеширование
    const existing = await this.userRepository.findOne({ where: { email: dto.email } })
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`)
    }
    const hashed = await argon2.hash(dto.password)

    // 2) Создаём и сразу сохраняем, чтобы получить id
    const user = this.userRepository.create({ email: dto.email, password: hashed })
    await this.userRepository.save(user) // Сохраняем, чтобы получить user.id

    // 3) Генерируем ключи
    let ethAddr: string | null = null
    let subAddr: string | null = null

    if (chain === 'substrate') {
      const { address, privateKey } = await this.substrateService.generateWallet(user.id)
      subAddr = address
      user.substratePublicKey = address
      // Сохраняем приватный ключ в Vault
      await this.vaultService.storeSecret(`substrate/${user.id}`, { privateKey })
    } else {
      const { address, privateKey } = await this.ethereumService.generateWallet(dto.email) // Используем email
      ethAddr = address
      user.publicKey = address
      // Сохраняем приватный ключ в Vault
      await this.vaultService.storeSecret(`ethereum/${user.id}`, { privateKey })
    }

    // 4) Обновляем запись одним save'ом
    await this.userRepository.save(user)

    return {
      id: user.id,
      email: user.email,
      publicKey: ethAddr,
      substratePublicKey: subAddr,
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
    let user =
      (await this.userRepository.findOne({ where: { googleId: userData.googleId } })) ??
      (await this.findByEmail(userData.email))

    let isNewUser = false
    if (!user) {
      this.logger.log(`Creating new OAuth user ${userData.email}`)
      user = this.userRepository.create({
        email: userData.email,
        displayName: userData.displayName,
        googleId: userData.googleId,
      })
      await this.userRepository.save(user)
      isNewUser = true
    } else if (!user.googleId) {
      // Связываем существующую учетную запись с Google
      this.logger.log(
        `Linking existing account ${userData.email} with Google ID ${userData.googleId}`
      )
      user.googleId = userData.googleId
      user.displayName = user.displayName || userData.displayName
      await this.userRepository.save(user)
    }

    // Проверяем, нужно ли генерировать кошелек
    const needSubstrateWallet = chain === 'substrate' && !user.substratePublicKey
    const needEthereumWallet = chain === 'ethereum' && !user.publicKey

    // Генерируем кошелек только для новых пользователей или если ключ отсутствует
    if (isNewUser || needSubstrateWallet || needEthereumWallet) {
      try {
        this.logger.log(
          `Checking/Generating ${chain} wallet for Google user ${user.email} (ID: ${user.id})`
        )

        if (chain === 'substrate') {
          // Проверяем существование секрета в Vault
          try {
            this.logger.log(
              `Attempting to get secret from Vault at substrate/${user.id} for user ${user.email}`
            )
            const existingSecret = await this.vaultService.getSecret(`substrate/${user.id}`)
            this.logger.log(
              `Secret check result: ${existingSecret ? 'Secret found' : 'No secret found'}`
            )

            if (!existingSecret || !existingSecret.privateKey) {
              this.logger.log(`No substrate key in Vault for ${user.email}, generating...`)

              // Добавим прямое вызывание SubstrateService без try/catch
              this.logger.log(`Calling substrateService.generateWallet for ${user.id}`)
              const walletResult = await this.substrateService.generateWallet(user.id)

              this.logger.log(
                `Generated wallet result: ${JSON.stringify({
                  address: walletResult.address,
                  hasPrivateKey: !!walletResult.privateKey,
                })}`
              )

              // Добавим явное обновление user.substratePublicKey
              user.substratePublicKey = walletResult.address
              this.logger.log(`Setting user.substratePublicKey to ${walletResult.address}`)

              // Вызовем storeSecret напрямую без try/catch
              this.logger.log(`Calling vaultService.storeSecret at substrate/${user.id}`)
              const storeResult = await this.vaultService.storeSecret(`substrate/${user.id}`, {
                privateKey: walletResult.privateKey,
              })
              this.logger.log(`Store result: ${JSON.stringify(storeResult)}`)

              // Сохраним пользователя
              await this.userRepository.save(user)
              this.logger.log(`User saved with substrate public key: ${user.substratePublicKey}`)
            } else {
              this.logger.log(`Found existing substrate key in Vault for ${user.email}`)
              // Проверим, установлен ли public key в БД
              if (!user.substratePublicKey) {
                this.logger.log(
                  `User has secret in Vault but no substratePublicKey in DB. Regenerating wallet...`
                )
                // Регенерируем wallet для получения public key
                const { address } = await this.substrateService.generateWallet(user.id)
                user.substratePublicKey = address
                await this.userRepository.save(user)
                this.logger.log(`Updated user with substrate public key: ${address}`)
              }
            }
          } catch (error) {
            this.logger.error(
              `CRITICAL ERROR handling vault for user ${user.email}: ${error.message}`
            )
            this.logger.error(`Error stack: ${error.stack}`)

            // Попробуем все-таки сгенерировать ключ
            try {
              this.logger.log(`Attempting emergency wallet generation for ${user.id}`)
              const { address, privateKey } = await this.substrateService.generateWallet(user.id)
              this.logger.log(`Emergency wallet generated with address: ${address}`)

              user.substratePublicKey = address
              await this.userRepository.save(user)

              this.logger.log(`Attempting emergency secret storage at substrate/${user.id}`)
              await this.vaultService.storeSecret(`substrate/${user.id}`, { privateKey })
              this.logger.log(`Emergency wallet and secret processed successfully`)
            } catch (emergencyError) {
              this.logger.error(
                `CRITICAL: Emergency wallet generation failed: ${emergencyError.message}`
              )
              // В этом случае мы не можем сделать ничего больше, кроме как вернуть пользователя без ключа
            }
          }
        } else {
          // Ethereum логика
          try {
            const existingSecret = await this.vaultService.getSecret(`ethereum/${user.id}`)
            if (!existingSecret || !existingSecret.privateKey) {
              this.logger.log(`No ethereum key in Vault for ${user.email}, generating...`)
              const { address, privateKey } = await this.ethereumService.generateWallet(user.id)
              user.publicKey = address
              await this.vaultService.storeSecret(`ethereum/${user.id}`, { privateKey })
              await this.userRepository.save(user)
              this.logger.log(`Generated ethereum key for ${user.email}: ${address}`)
            } else {
              this.logger.log(`Found existing ethereum key in Vault for ${user.email}`)
            }
          } catch (error) {
            this.logger.error(`Failed to check/retrieve ethereum key from Vault: ${error.message}`)
            // Генерируем новый ключ если произошла ошибка
            const { address, privateKey } = await this.ethereumService.generateWallet(user.id)
            user.publicKey = address
            await this.vaultService.storeSecret(`ethereum/${user.id}`, { privateKey })
            await this.userRepository.save(user)
            this.logger.log(`Generated new ethereum key after error: ${address}`)
          }
        }
      } catch (error) {
        this.logger.error(`Failed to generate wallet for Google user ${user.email}`, error)
      }
    }

    // Now unifiedKey is either substratePublicKey or publicKey
    const unifiedKey = user.substratePublicKey ?? user.publicKey
    return {
      id: user.id,
      email: user.email,
      googleId: user.googleId!,
      displayName: user.displayName!,
      publicKey: unifiedKey!,
    }
  }
}
