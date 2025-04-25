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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger'
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {}

  @ApiOperation({ summary: 'Start Google authentication' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    this.logger.log('→ [Auth] GET /auth/google invoked; redirecting to Google')
  }

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

  @ApiOperation({
    summary: 'Get authenticated user data',
    description:
      'Retrieves detailed user information using the user ID from the JWT token. The endpoint requires authentication and extracts the user ID from the token to fetch complete user data from the database. Ensure to send the authToken cookie with the request.',
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
  @ApiResponse({ status: 500, description: 'User not found or server error' })
  @ApiBearerAuth()
  @Get('user-info')
  @UseGuards(AuthGuard('jwt'))
  async getUserInfo(@GetUser() user: User) {
    this.logger.log(`[Auth] GET /auth/user-info invoked`)

    if (!user) {
      this.logger.error('[Auth] User not authenticated')
      throw new InternalServerErrorException('User not authenticated')
    }

    this.logger.log(`[Auth] Request from user: ${user.email}`)

    const userId = user.id
    const userInfo = await this.usersService.findById(userId)

    if (!userInfo) {
      this.logger.error(`[Auth] User with ID ${userId} not found in database`)
      throw new InternalServerErrorException('User not found')
    }

    return userInfo
  }

  @ApiOperation({ summary: 'Logout (delete cookie)' })
  @Get('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.logger.log('[Auth] GET /auth/logout invoked; clearing authToken cookie')
    res.clearCookie('authToken')
    this.logger.log('[Auth] authToken cookie cleared successfully')
    return { success: true }
  }

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
  async getUserById(@Param('id') id: string, @GetUser() requestUser: User) {
    this.logger.log(`[Auth] GET /auth/user/${id} invoked by user: ${requestUser.email}`)

    const user = await this.usersService.findById(id)

    if (!user) {
      this.logger.warn(`[Auth] User with ID ${id} not found`)
      throw new NotFoundException(`User with ID ${id} not found`)
    }

    this.logger.log(`[Auth] Retrieved user data for ID: ${id}`)
    return user
  }
}
