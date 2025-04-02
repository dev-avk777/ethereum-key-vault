import { Strategy } from 'passport-local'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { User } from '../entities/user.entity'

/**
 * LocalStrategy реализует локальную стратегию аутентификации с использованием Passport.
 * По умолчанию Passport ищет поля username и password, но мы переопределяем это,
 * чтобы использовать email вместо username.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // Указываем, что поле для логина – это email, а не username
    super({ usernameField: 'email' })
  }

  /**
   * Метод validate вызывается автоматически Passport'ом при аутентификации.
   * Если учетные данные неверны, выбрасывается исключение UnauthorizedException.
   * @param email - Email пользователя.
   * @param password - Пароль пользователя.
   * @returns Объект пользователя, если аутентификация прошла успешно.
   */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.authService.validateUser(email, password)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }
    return user
  }
}
