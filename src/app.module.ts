import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { UsersModule } from './modules/users.module'
import { AuthModule } from './modules/auth.module'
import { databaseConfig } from './config/database.config'
import { EthereumController } from './controllers/ethereum.controller'

@Module({
  imports: [
    // Load environment variables and make them globally available
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Explicitly specify path to .env file
    }),
    // Connect to database with configuration from database.config.ts
    TypeOrmModule.forRoot(databaseConfig),
    // Connect users and authentication module
    UsersModule,
    // Connect Google OAuth authentication module
    AuthModule,
  ],
  controllers: [EthereumController],
  providers: [],
})
export class AppModule {}
