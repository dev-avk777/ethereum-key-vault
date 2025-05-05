import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { databaseConfig } from './config/database.config'
import { VaultConfigModule } from './config/vault.config'
import { AuthModule } from './modules/auth.module'
import { SubstrateModule } from './modules/substrate.module'
import { UsersModule } from './modules/users.module'
import { VaultServiceProvider } from './services/vault.service'
import { EthereumModule } from './modules/ethereum.module'

@Module({
  imports: [
    // Load environment variables and make them globally available
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Explicitly specify path to .env file
    }),
    VaultConfigModule,
    // Connect to database with configuration from database.config.ts
    TypeOrmModule.forRoot(databaseConfig),
    // Connect users and authentication module
    UsersModule,
    // Connect Google OAuth authentication module
    AuthModule,
    // Connect Ethereum module
    EthereumModule,
    // Connect Substrate module
    SubstrateModule,
  ],
  controllers: [],
  providers: [
    // Keeping only VaultServiceProvider, WalletService is now in WalletModule
    VaultServiceProvider,
  ],
})
export class AppModule {}
