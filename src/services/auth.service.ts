import { Injectable } from '@nestjs/common'
import { type UsersService } from './users.service'
import { type User } from '../entities/user.entity'
import * as argon2 from 'argon2'

/**
 * AuthService служит для проверки учетных данных пользователя.
 * Он использует UsersService для валидации email и пароля.
 */
@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Валидирует пользователя по email и паролю.
   * @param email - Email пользователя.
   * @param password - Пароль пользователя.
   * @returns Объект пользователя, если учетные данные корректны, или undefined.
   */
  async validateUser(email: string, password: string): Promise<User | undefined> {
    const user = await this.usersService.findByEmail(email)
    if (!user) {
      return undefined
    }

    const isPasswordValid = await argon2.verify(user.password, password)
    if (!isPasswordValid) {
      return undefined
    }

    return user
  }
}
