import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  InternalServerErrorException,
  Logger,
  Param,
  NotFoundException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Request, Response } from 'express'
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiProperty,
} from '@nestjs/swagger'
import { UsersService } from '../services/users.service'
import { User } from '../entities/user.entity'
import { GetUser } from '../decorators/get-user.decorator'

interface AuthenticatedUser {
  id: string
  email: string
  googleId: string
  displayName: string
  publicKey: string
}

// DTO for user response
class UserResponse {
  @ApiProperty() id: string
  @ApiProperty() email: string
  @ApiProperty({ nullable: true }) displayName?: string | null
  @ApiProperty({ description: 'Unified public key (Ethereum or Substrate)', nullable: true })
  publicKey: string | null
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {}

  /**
   * Initiates Google authentication process.
   * Redirects the user to Google for authentication.
   */
  @ApiOperation({ summary: 'Start Google authentication' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    this.logger.log('→ [Auth] GET /auth/google invoked; redirecting to Google')
  }

  /**
   * Handles the callback from Google OAuth after authentication.
   * Retrieves user information and sets a JWT token in a cookie.
   * Redirects the user to the frontend application.
   * @param req - The request object containing user information.
   * @param res - The response object used to set cookies and redirect.
   */
  @ApiOperation({ summary: 'Callback from Google OAuth' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    this.logger.log('← [Auth] GET /auth/google/callback invoked')
    const user = req.user as AuthenticatedUser
    this.logger.debug(`[Auth] Google payload: ${JSON.stringify(user)}`)

    if (!user || !user.id) {
      this.logger.error('No user from GoogleStrategy', { user })
      throw new InternalServerErrorException('Authentication failed')
    }

    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
      googleId: user.googleId,
      displayName: user.displayName,
      publicKey: user.publicKey,
    })
    this.logger.debug(`[Auth] JWT generated for ${user.email}`)

    const isProd = this.configService.get('NODE_ENV') === 'production'
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    })
    this.logger.log(`[Auth] Cookie set for ${user.email}`)

    const frontendUrl = this.configService.get<string>('FRONTEND_URL')
    if (!frontendUrl) {
      this.logger.error('FRONTEND_URL is not set')
      throw new InternalServerErrorException('Server misconfiguration')
    }

    const userDataParam = encodeURIComponent(
      JSON.stringify({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        publicKey: user.publicKey,
      })
    )
    const redirectUrl = `${frontendUrl}/callback?userData=${userDataParam}`
    this.logger.log(`[Auth] Redirecting to frontend: ${redirectUrl}`)
    res.redirect(redirectUrl)
  }

  /**
   * Retrieves authenticated user data.
   * Requires a valid JWT token to access this endpoint.
   * @param user - The authenticated user object retrieved from the JWT token.
   * @returns User information from the database.
   */
  @ApiOperation({ summary: 'Get authenticated user data' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: UserResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('user-info')
  @UseGuards(AuthGuard('jwt'))
  async getUserInfo(@GetUser() user: User): Promise<UserResponse> {
    this.logger.log(`[Auth] GET /auth/user-info invoked for ${user.email}`)

    const userEntity = await this.usersService.findById(user.id)
    if (!userEntity) {
      this.logger.error(`[Auth] User not found: ${user.id}`)
      throw new NotFoundException()
    }

    const unifiedKey = userEntity.substratePublicKey ?? userEntity.publicKey
    return {
      id: userEntity.id,
      email: userEntity.email,
      displayName: userEntity.displayName ?? null,
      publicKey: unifiedKey,
    }
  }

  /**
   * Logs out the user by clearing the authToken cookie.
   * @param res - The response object used to clear the cookie.
   * @returns Success message.
   */
  @ApiOperation({ summary: 'Logout (delete cookie)' })
  @Get('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.logger.log('[Auth] GET /auth/logout invoked; clearing authToken cookie')
    res.clearCookie('authToken')
    this.logger.log('[Auth] authToken cookie cleared successfully')
    return { success: true }
  }

  /**
   * Retrieves user data by ID.
   * Requires authentication to access this endpoint.
   * @param id - The user ID (UUID) to retrieve information for.
   * @returns User information.
   */
  @ApiOperation({
    summary: 'Get user data by ID',
    description: 'Retrieves user information by ID. Requires authentication.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'User ID (UUID)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        displayName: 'John Doe',
        publicKey: '0x1234567890abcdef',
        googleId: 'google_id_123456',
        createdAt: '2025-04-23T08:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - valid JWT token is required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth()
  @Get('user/:id')
  @UseGuards(AuthGuard('jwt'))
  async getUser(@Param('id') id: string): Promise<UserResponse> {
    const user = await this.usersService.findById(id)
    if (!user) {
      throw new NotFoundException()
    }

    // if user.publicKey is not null, use it as unifiedKey
    // otherwise, use user.substratePublicKey
    const unifiedKey = user.publicKey ?? user.substratePublicKey

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? null,
      publicKey: unifiedKey,
    }
  }
}
