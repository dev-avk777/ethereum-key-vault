import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { GoogleStrategy } from '../auth/google.strategy'
import { LocalStrategy } from '../auth/local.strategy'
import { JwtStrategy } from '../auth/jwt.strategy'
import { AuthService } from '../services/auth.service'
import { UsersModule } from './users.module'
import { AuthController } from '../controllers/auth.controller'

/**
 * AuthModule объединяет все компоненты, связанные с аутентификацией:
 * - Стратегии аутентификации (локальная и Google OAuth)
 * - Сервисы аутентификации
 * - Контроллер для обработки запросов
 * - Настройки JWT для токенов
 */
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, GoogleStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
