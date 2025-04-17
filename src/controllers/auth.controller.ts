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

// Интерфейс, совпадает с тем, что возвращает GoogleStrategy
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

  @ApiOperation({ summary: 'Начать авторизацию через Google' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    // Passport сам сделает редирект на Google
    this.logger.log('Redirecting to Google OAuth endpoint')
  }

  @ApiOperation({ summary: 'Callback от Google OAuth' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    // req.user пришёл из GoogleStrategy.validate()
    const user = req.user as AuthenticatedUser
    if (!user || !user.id) {
      this.logger.error('No user from GoogleStrategy', { user })
      throw new InternalServerErrorException('Authentication failed')
    }

    // Подписываем JWT
    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
      googleId: user.googleId,
      displayName: user.displayName,
      publicKey: user.publicKey,
    })

    // Готовим cookie
    const isProd = this.configService.get('NODE_ENV') === 'production'
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    })

    // Редирект на фронтенд (без лишних ?redirect_uri или ?userData)
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
    this.logger.log(`Authenticated, redirecting to → ${redirectUrl}`)
    console.log('>>> env FRONTEND_URL =', process.env.FRONTEND_URL)
    res.redirect(`${frontendUrl}/callback?userData=${userDataParam}`)
  }

  @ApiOperation({ summary: 'Получить данные авторизованного пользователя' })
  @ApiBearerAuth()
  @Get('user-info')
  @UseGuards(AuthGuard('jwt'))
  getUserInfo(@Req() req: Request) {
    return req.user
  }

  @ApiOperation({ summary: 'Выйти (удалить cookie)' })
  @Get('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('authToken')
    return { success: true }
  }
}
