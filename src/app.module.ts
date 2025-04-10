import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { UsersModule } from './modules/users.module'
import { AuthModule } from './modules/auth.module'
import { databaseConfig } from './config/database.config'

@Module({
  imports: [
    // Загружаем переменные окружения и делаем их доступными глобально
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Явно указываем путь к .env файлу
    }),
    // Подключаем базу данных с конфигурацией из database.config.ts
    TypeOrmModule.forRoot(databaseConfig),
    // Подключаем модуль пользователей и аутентификации
    UsersModule,
    // Подключаем модуль аутентификации через Google OAuth
    AuthModule,
  ],
})
export class AppModule {}
