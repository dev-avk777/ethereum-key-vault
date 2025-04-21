import { Strategy } from 'passport-local'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { User } from '../entities/user.entity'

/**
 * LocalStrategy implements local authentication strategy using Passport.
 * By default, Passport looks for username and password fields, but we override this
 * to use email instead of username.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // Specify that the login field is email, not username
    super({ usernameField: 'email' })
  }

  /**
   * The validate method is called automatically by Passport during authentication.
   * If credentials are invalid, UnauthorizedException is thrown.
   * @param email - User's email.
   * @param password - User's password.
   * @returns User object if authentication is successful.
   */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.authService.validateUser(email, password)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }
    return user
  }
}
