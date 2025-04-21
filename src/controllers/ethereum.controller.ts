import { Controller, Get, Req, UseGuards, NotFoundException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request } from 'express'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from '../services/users.service'

interface JwtUser {
  id: string
  email: string
  googleId?: string
  displayName?: string
  publicKey?: string
}

/**
 * EthereumController handles requests related to users' Ethereum keys.
 * Provides an endpoint to retrieve the public key (Ethereum address) of a user.
 */
@ApiTags('ethereum')
@Controller('ethereum')
export class EthereumController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Gets the public key (Ethereum address) of the currently authenticated user.
   * Requires JWT authentication.
   */
  @ApiOperation({ summary: 'Get Ethereum keys of the user' })
  @ApiBearerAuth()
  @Get('keys')
  @UseGuards(AuthGuard('jwt'))
  async getKeys(@Req() req: Request) {
    const user = req.user as JwtUser
    let publicKey: string

    // If public key exists in JWT token, use it
    if (user.publicKey) {
      publicKey = user.publicKey
    } else {
      // If public key doesn't exist in JWT token, get it from database
      const userFromDb = await this.usersService.findById(user.id)

      if (!userFromDb || !userFromDb.publicKey) {
        throw new NotFoundException('Ethereum keys not found for this user')
      }

      publicKey = userFromDb.publicKey
    }

    // Return an array with one object so frontend can use array methods
    return [
      {
        id: '1', // Use fixed id since we only have one key per user
        publicKey: publicKey,
        name: 'Primary Key', // Add default name
        createdAt: new Date().toISOString(), // Add current date as creation date
      },
    ]
  }
}
