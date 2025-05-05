import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, Profile, StrategyOptions } from 'passport-google-oauth20'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../services/users.service'

// User that will be placed in req.user
interface AuthenticatedUser {
  id: string
  email: string
  googleId: string
  displayName: string
  publicKey: string
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID')
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET')
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL')

    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error('Google OAuth configuration is incomplete')
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    } as StrategyOptions)

    this.logger.log(`GoogleStrategy initialized (clientID=${clientID})`)
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile
  ): Promise<AuthenticatedUser> {
    const { id, emails, displayName } = profile
    if (!id || !emails || emails.length === 0) {
      this.logger.error('Invalid Google profile data', { profile })
      throw new UnauthorizedException('Invalid Google profile')
    }

    // Take email and initial displayName from the profile
    const email = emails[0].value
    const initialName = displayName ?? email

    // TODO: сюда можно подать параметр chain из URL,
    //    e.g. добавить два роута /auth/google/ethereum и /auth/google/substrate
    //    и брать chain = 'ethereum' | 'substrate' по маршруту.
    const chain: 'ethereum' | 'substrate' = 'substrate'
    // findOrCreateFromGoogle may return user.googleId and user.displayName as string|null
    const user = await this.usersService.findOrCreateFromGoogle(
      {
        googleId: id,
        email,
        displayName: initialName,
      },
      chain
    )

    // Convert both fields to string - either from DB or from initial values
    const finalGoogleId = user.googleId ?? id
    const finalDisplayName = user.displayName ?? initialName

    return {
      id: user.id,
      email: user.email,
      googleId: finalGoogleId,
      displayName: finalDisplayName,
      publicKey: user.publicKey ?? '',
    }
  }
}
