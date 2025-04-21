import { Injectable } from '@nestjs/common'
import { UsersService } from './users.service'
import { User } from '../entities/user.entity'
import * as argon2 from 'argon2'

/**
 * AuthService is used to verify user credentials.
 * It uses UsersService to validate email and password.
 */
@Injectable()
export class AuthService {
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
      return undefined
    }

    // Check if user has password (might not if registered with OAuth)
    if (!user.password) {
      return undefined
    }

    // Verify password using argon2
    const isPasswordValid = await argon2.verify(user.password, password)
    if (!isPasswordValid) {
      return undefined
    }

    return user
  }
}
