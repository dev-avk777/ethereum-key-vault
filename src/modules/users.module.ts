import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { UsersService } from '../services/users.service'
import { VaultService } from '../services/vault.service'
import { UsersController } from '../controllers/users.controller'
import { AuthService } from '../services/auth.service'
import { LocalStrategy } from '../auth/local.strategy'
import { PassportModule } from '@nestjs/passport'

/**
 * Модуль UsersModule объединяет все компоненты, связанные с пользователями:
 * - Сущность User (для работы с базой данных).
 * - Сервисы для управления пользователями и Vault.
 * - Контроллер для обработки запросов.
 * - Аутентификацию через Passport (LocalStrategy).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), PassportModule],
  controllers: [UsersController],
  providers: [VaultService, UsersService, AuthService, LocalStrategy],
  exports: [UsersService, AuthService],
})
export class UsersModule {}
