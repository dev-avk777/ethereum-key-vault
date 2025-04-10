import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, VerifyCallback, StrategyOptions, Profile } from 'passport-google-oauth20'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../services/users.service'

/**
 * GoogleStrategy реализует аутентификацию через Google OAuth.
 * Она использует библиотеку passport и passport-google-oauth20 для обработки OAuth-потока.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {
    const googleClientId = configService.get<string>('GOOGLE_CLIENT_ID')
    const googleClientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET')
    const googleCallbackUrl = configService.get<string>('GOOGLE_CALLBACK_URL')

    if (!googleClientId || !googleClientSecret || !googleCallbackUrl) {
      throw new Error('Google OAuth configuration is incomplete')
    }

    super({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: googleCallbackUrl,
      scope: ['email', 'profile'],
    } as StrategyOptions)
  }

  /**
   * Метод validate вызывается после успешной аутентификации пользователя через Google.
   * Здесь мы проверяем, существует ли пользователь с таким Google ID в нашей системе.
   * Если пользователь не существует, мы создаем нового пользователя с его Google профилем.
   * @param accessToken - Токен доступа от Google
   * @param refreshToken - Токен обновления от Google
   * @param profile - Профиль пользователя Google
   * @param done - Функция обратного вызова для возврата пользователя
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> {
    try {
      const { id, name, emails } = profile

      if (!id || !emails || emails.length === 0) {
        this.logger.error('Incomplete profile data from Google')
        return done(new Error('Invalid profile data from Google'), undefined)
      }

      // Создаем объект пользователя, который будет передан в done()
      const userData = {
        googleId: id,
        email: emails[0].value,
        displayName: name ? name.givenName + ' ' + name.familyName : emails[0].value,
      }

      try {
        // Находим или создаем пользователя
        const user = await this.usersService.findOrCreateFromGoogle(userData)
        // Передаем пользователя в done()
        done(null, user)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.logger.error(`Error processing Google authentication: ${errorMessage}`)
        done(error as Error, undefined)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Unexpected error in Google validation: ${errorMessage}`)
      done(error as Error, undefined)
    }
  }
}
