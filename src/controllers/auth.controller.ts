import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Request, Response } from 'express'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

// Интерфейс для типизации пользователя, возвращаемого GoogleStrategy
interface AuthenticatedUser {
  id: string
  email: string
  googleId: string | null
  displayName: string | null
  publicKey: string // Убираем | null, так как в User это поле не nullable
}

/**
 * AuthController обрабатывает запросы, связанные с аутентификацией через Google OAuth.
 * Он предоставляет два основных эндпоинта:
 * - GET /auth/google - начало процесса аутентификации через Google
 * - GET /auth/google/callback - обработка ответа от Google
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  @ApiOperation({ summary: 'Начать процесс авторизации через Google' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(@Req() req: Request) {
    // Этот метод не будет вызван, так как Passport сразу перенаправит на Google
    // Но мы можем добавить логирование для дебага
    this.logger.log(`Starting Google authentication, redirect_uri: ${req.query.redirect_uri}`)
  }

  @ApiOperation({ summary: 'Обработка ответа от Google OAuth' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const user = req.user as AuthenticatedUser

      if (!user || !user.id) {
        this.logger.error('No user data received from Google OAuth', {
          userId: user?.id,
          email: user?.email,
        })
        throw new InternalServerErrorException('Authentication failed')
      }

      const token = this.jwtService.sign({
        id: user.id,
        email: user.email,
        googleId: user.googleId,
        displayName: user.displayName,
        publicKey: user.publicKey,
      })

      const frontendUrl = this.configService.get<string>('FRONTEND_URL')
      if (!frontendUrl) {
        this.logger.error('FRONTEND_URL is not configured')
        throw new InternalServerErrorException('Server configuration error')
      }

      this.logger.log(`Using frontend URL: ${frontendUrl}`)

      // Обновляем настройки куки для обеспечения работы в Docker и в production
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: false, // Всегда false для локальной разработки и Docker
        sameSite: 'lax', // Используем lax для лучшей совместимости
        maxAge: 24 * 60 * 60 * 1000, // 24 часа
        path: '/', // Важно для доступности куки во всем приложении
        domain: undefined, // Убираем domain для работы в разных окружениях
      })

      // Передаем данные пользователя в URL для фронтенда
      const userDataParam = encodeURIComponent(
        JSON.stringify({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          publicKey: user.publicKey,
        })
      )

      this.logger.log(`Redirecting to ${frontendUrl}/callback with user data`)
      res.redirect(`${frontendUrl}/callback?userData=${userDataParam}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Error during Google authentication callback: ${errorMessage}`, {
        userId: (req.user as AuthenticatedUser)?.id,
        email: (req.user as AuthenticatedUser)?.email,
      })
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3007'
      res.redirect(
        `${frontendUrl}/auth-error?message=${encodeURIComponent('Authentication failed')}&code=500`
      )
    }
  }

  @ApiOperation({ summary: 'Получить информацию о текущем пользователе' })
  @ApiBearerAuth()
  @Get('user-info')
  @UseGuards(AuthGuard('jwt'))
  getUserInfo(@Req() req: Request) {
    return req.user
  }

  @ApiOperation({ summary: 'Выйти из системы' })
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    // Обновляем параметры удаления куки, чтобы они совпадали с установкой
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    })
    return { success: true, message: 'Logged out successfully' }
  }
}
