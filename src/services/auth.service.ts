import { Injectable } from '@nestjs/common'
import { type UsersService } from './users.service'
import { type User } from '../entities/user.entity'

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
   * @returns Объект пользователя, если учетные данные корректны, или null.
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    return this.usersService.validateUser(email, password)
  }
}
