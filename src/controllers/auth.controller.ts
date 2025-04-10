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

  /**
   * Инициирует процесс аутентификации через Google.
   * Перенаправляет пользователя на страницу аутентификации Google.
   */
  @ApiOperation({ summary: 'Начать процесс авторизации через Google' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Этот метод не будет вызван, так как Passport сразу перенаправит на Google
  }

  /**
   * Обрабатывает ответ от Google после успешной аутентификации.
   * Создает JWT токен и перенаправляет пользователя на фронтенд с токеном.
   * @param req - HTTP запрос, содержащий данные пользователя
   * @param res - HTTP ответ для перенаправления
   */
  @ApiOperation({ summary: 'Обработка ответа от Google OAuth' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      // Получаем пользователя из запроса (добавлен Passport стратегией)
      const user = req.user as {
        id: string
        email: string
        googleId: string
        displayName: string
        publicKey: string
      }

      if (!user || !user.id) {
        this.logger.error('No user data received from Google OAuth')
        throw new InternalServerErrorException('Authentication failed')
      }

      // Создаем JWT токен с данными пользователя
      const token = this.jwtService.sign({
        id: user.id,
        email: user.email,
        googleId: user.googleId,
        displayName: user.displayName,
        publicKey: user.publicKey,
      })

      // Получаем URL фронтенда из конфигурации
      const frontendUrl = this.configService.get<string>('FRONTEND_URL')
      if (!frontendUrl) {
        this.logger.error('FRONTEND_URL is not configured')
        throw new InternalServerErrorException('Server configuration error')
      }

      // Перенаправляем на фронтенд с токеном в параметрах URL
      res.redirect(`${frontendUrl}/profile?authToken=${token}`)
    } catch (error) {
      this.logger.error(`Error during Google authentication callback: ${error.message}`)
      // Перенаправляем на страницу ошибки на фронтенде
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'
      res.redirect(
        `${frontendUrl}/auth-error?message=${encodeURIComponent('Authentication failed')}`
      )
    }
  }

  /**
   * Возвращает информацию о пользователе на основе JWT токена.
   * @param req - HTTP запрос, содержащий данные пользователя
   * @returns Информация о пользователе
   */
  @ApiOperation({ summary: 'Получить информацию о текущем пользователе' })
  @ApiBearerAuth()
  @Get('user-info')
  @UseGuards(AuthGuard('jwt'))
  getUserInfo(@Req() req: Request) {
    return req.user
  }
}
