import { Injectable, Logger } from '@nestjs/common'
import { UsersService } from './users.service'
import { User } from '../entities/user.entity'
import * as argon2 from 'argon2'

/**
 * AuthService is used to verify user credentials.
 * It uses UsersService to validate email and password.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly usersService: UsersService) {}

  /**
   * Validates a user by email and password.
   * @param email - User's email.
   * @param password - User's password.
   * @returns User object if credentials are valid, or undefined.
   */
  async validateUser(email: string, password: string): Promise<User | undefined> {
    // Find user by email
    const user = await this.usersService.findByEmail(email)
    if (!user) {
      this.logger.warn(`[Auth] User with email ${email} not found`)
      return undefined
    }

    // Check if user has password (might not if registered with OAuth)
    if (!user.password) {
      this.logger.warn(`[Auth] User ${email} has no password (likely OAuth user)`)
      return undefined
    }

    // Verify password using argon2
    const isPasswordValid = await argon2.verify(user.password, password)
    if (!isPasswordValid) {
      this.logger.warn(`[Auth] Invalid password for user ${email}`)
      return undefined
    }

    this.logger.log(`[Auth] User ${email} authenticated successfully`)
    return user
  }
}
