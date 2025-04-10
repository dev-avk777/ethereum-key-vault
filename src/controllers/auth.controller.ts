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
  googleAuth() {
    // Этот метод не будет вызван, так как Passport сразу перенаправит на Google
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

      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      })

      res.redirect(`${frontendUrl}/profile`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Error during Google authentication callback: ${errorMessage}`, {
        userId: (req.user as AuthenticatedUser)?.id,
        email: (req.user as AuthenticatedUser)?.email,
      })
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'
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
}
