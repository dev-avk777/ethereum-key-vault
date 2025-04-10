import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, VerifyCallback, StrategyOptions, Profile } from 'passport-google-oauth20'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../services/users.service'

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
  publicKey: string // Убираем | null, так как в User это поле не nullable
}

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

    // Логируем значения для отладки
    this.logger.log(`GOOGLE_CLIENT_ID: ${googleClientId}`)
    this.logger.log(`GOOGLE_CLIENT_SECRET: ${googleClientSecret}`)
    this.logger.log(`GOOGLE_CALLBACK_URL: ${googleCallbackUrl}`)
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> {
    try {
      const { id, emails, name } = profile

      if (!id || !emails || emails.length === 0) {
        this.logger.error('Incomplete profile data from Google', { googleId: id })
        return done(new Error('Invalid profile data from Google'), undefined)
      }

      const userData: GoogleUserData = {
        googleId: id,
        email: emails[0].value,
        displayName: name
          ? `${name.givenName || ''} ${name.familyName || ''}`.trim()
          : emails[0].value,
      }

      try {
        const user: AuthenticatedUser = await this.usersService.findOrCreateFromGoogle(userData)
        done(null, user)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.logger.error(`Error processing Google authentication: ${errorMessage}`, {
          googleId: id,
          email: userData.email,
        })
        done(error as Error, undefined)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Unexpected error in Google validation: ${errorMessage}`)
      done(error as Error, undefined)
    }
  }
}
