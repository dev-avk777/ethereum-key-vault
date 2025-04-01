import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { type Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { type CreateUserDto } from '../dto/create-user.dto'
import { type VaultService } from './vault.service'
import { Wallet } from 'ethers'
import * as bcrypt from 'bcrypt'

/**
 * UsersService содержит логику по регистрации пользователя, генерации Ethereum кошелька,
 * сохранению приватного ключа в Vault и публичного ключа в базе данных.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private readonly vaultService: VaultService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {}

  /**
   * Регистрирует нового пользователя:
   * 1. Хеширует пароль с помощью bcrypt.
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

    // Хеширование пароля с использованием bcrypt для безопасного хранения
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Генерация нового Ethereum-кошелька с использованием библиотеки ethers
    const wallet = Wallet.createRandom()
    const privateKey = wallet.privateKey
    const publicKey = wallet.address

    // Сохранение приватного ключа в Vault по пути, зависящему от email
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
  }

  /**
   * Находит пользователя по email.
   * @param email - Email пользователя.
   * @returns Объект пользователя или undefined, если не найден.
   */
  async findByEmail(email: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { email } })
  }

  /**
   * Валидирует пользователя по email и паролю.
   * Сравнивает предоставленный пароль с хешированным в базе данных.
   * @param email - Email пользователя.
   * @param password - Пароль для проверки.
   * @returns Объект пользователя, если проверка пройдена, или null в противном случае.
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email)
    if (user && (await bcrypt.compare(password, user.password))) {
      return user
    }
    return null
  }
}
