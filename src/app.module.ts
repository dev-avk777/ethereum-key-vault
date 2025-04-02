import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { UsersModule } from './modules/users.module'
import { databaseConfig } from './config/database.config'

/**
 * Основной модуль приложения.
 * Здесь подключаются глобальные модули, такие как конфигурация (ConfigModule),
 * подключение к базе данных (TypeOrmModule) и модуль пользователей (UsersModule).
 */
@Module({
  imports: [
    // Загружаем переменные окружения и делаем их доступными глобально
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Подключаем базу данных с конфигурацией из database.config.ts
    TypeOrmModule.forRoot(databaseConfig),
    // Подключаем модуль пользователей и аутентификации
    UsersModule,
  ],
})
export class AppModule {}
