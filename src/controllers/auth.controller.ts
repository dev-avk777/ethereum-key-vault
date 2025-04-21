import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Request, Response } from 'express'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

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
    private readonly configService: ConfigService
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

  @ApiOperation({ summary: 'Get authenticated user data' })
  @ApiBearerAuth()
  @Get('user-info')
  @UseGuards(AuthGuard('jwt'))
  getUserInfo(@Req() req: Request) {
    this.logger.log(`[Auth] GET /auth/user-info invoked by ${(<any>req.user).email}`)
    this.logger.debug(`[Auth] JWT payload: ${JSON.stringify(req.user)}`)
    return req.user
  }

  @ApiOperation({ summary: 'Logout (delete cookie)' })
  @Get('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.logger.log('[Auth] GET /auth/logout invoked; clearing authToken cookie')
    res.clearCookie('authToken')
    this.logger.log('[Auth] authToken cookie cleared successfully')
    return { success: true }
  }
}
