import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { CreateUserDto } from '../dto/create-user.dto'
import { VaultService } from './vault.service'
import { Wallet } from 'ethers'
import * as argon2 from 'argon2'

// Интерфейс для данных пользователя, получаемых от Google
interface GoogleUserData {
  googleId: string
  email: string
  displayName: string
}

// Интерфейс для типизации пользователя, возвращаемого UsersService
interface AuthenticatedUser {
  id: string
  email: string
  googleId: string | null
  displayName: string | null
  publicKey: string
}

/**
 * UsersService содержит логику по регистрации пользователя, генерации Ethereum кошелька,
 * сохранению приватного ключа в Vault и публичного ключа в базе данных.
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
   * Регистрирует нового пользователя:
   * 1. Хеширует пароль с помощью argon2.
   * 2. Генерирует новый Ethereum-кошелёк.
   * 3. Сохраняет приватный ключ в Vault.
   * 4. Сохраняет пользователя с email, хешированным паролем и публичным ключом в PostgreSQL.
   *
   * @param createUserDto - Данные для регистрации (email и пароль).
   * @returns Объект с данными пользователя (без пароля).
   */
  async registerUser(
    createUserDto: CreateUserDto
  ): Promise<{ id: string; email: string; publicKey: string }> {
    const { email, password } = createUserDto

    // Хеширование пароля с использованием argon2 для безопасного хранения
    const hashedPassword = await argon2.hash(password)

    // Генерация нового Ethereum-кошелька
    const wallet = Wallet.createRandom()
    const privateKey = wallet.privateKey
    const publicKey = wallet.address

    try {
      // Сохранение приватного ключа в Vault
      const vaultPath = `secret/ethereum/${email}`
      await this.vaultService.storeSecret(vaultPath, { privateKey })

      // Создание экземпляра пользователя и сохранение в базе данных PostgreSQL
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        publicKey,
      })
      await this.userRepository.save(user)

      this.logger.log(`Registered user ${email} with public Ethereum address ${publicKey}`)

      // Возвращаем данные пользователя (без пароля)
      return { id: user.id, email: user.email, publicKey: user.publicKey }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to register user ${email}: ${errorMessage}`)
      throw new InternalServerErrorException(`Failed to register user: ${errorMessage}`)
    }
  }

  /**
   * Находит пользователя по email.
   * @param email - Email пользователя.
   * @returns Объект пользователя или null, если не найден.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } })
  }

  /**
   * Находит пользователя по ID.
   * @param id - ID пользователя.
   * @returns Объект пользователя или null, если не найден.
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } })
  }

  /**
   * Валидирует пользователя по email и паролю.
   * Сравнивает предоставленный пароль с хешированным в базе данных.
   * @param email - Email пользователя.
   * @param password - Пароль для проверки.
   * @returns Объект пользователя, если проверка пройдена, или undefined в противном случае.
   */
  async validateUser(email: string, password: string): Promise<User | undefined> {
    const user = await this.findByEmail(email)
    if (user && user.password && (await argon2.verify(user.password, password))) {
      return user
    }
    return undefined
  }

  /**
   * Находит пользователя по Google ID или создает нового пользователя.
   * Для новых пользователей генерируется Ethereum-кошелёк.
   * @param userData - Данные пользователя из Google OAuth
   * @returns Объект пользователя
   */
  async findOrCreateFromGoogle(userData: GoogleUserData): Promise<AuthenticatedUser> {
    if (!userData.googleId || !userData.email) {
      this.logger.error('Incomplete user data from Google OAuth')
      throw new Error('Incomplete user data for OAuth authentication')
    }

    try {
      // Ищем пользователя по Google ID
      let user = await this.userRepository.findOne({
        where: { googleId: userData.googleId },
      })

      // Если пользователь не найден по Google ID, проверяем по email
      if (!user && userData.email) {
        user = await this.findByEmail(userData.email)
      }

      // Если пользователь не найден, создаем нового
      if (!user) {
        this.logger.log(`Creating new user from Google OAuth: ${userData.email}`)

        // Генерируем Ethereum кошелёк
        const wallet = Wallet.createRandom()
        const privateKey = wallet.privateKey
        const publicKey = wallet.address

        try {
          // Сохраняем приватный ключ в Vault
          const vaultPath = `secret/ethereum/oauth_${userData.email}`
          await this.vaultService.storeSecret(vaultPath, { privateKey })

          // Создаем нового пользователя
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
        // Если пользователь найден по email, но у него нет Google ID,
        // обновляем его данные
        this.logger.log(`Linking existing user ${userData.email} with Google account`)
        user.googleId = userData.googleId
        user.displayName = userData.displayName
        await this.userRepository.save(user)
      }

      // Преобразуем User в AuthenticatedUser
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
