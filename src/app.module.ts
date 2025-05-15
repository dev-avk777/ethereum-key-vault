import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { databaseConfig } from './config/database.config'
import { substrateConfig } from './config/substrate.config'
import { AuthModule } from './modules/auth.module'
import { UsersModule } from './modules/users.module'
import { EthereumModule } from './modules/ethereum.module'
import { SubstrateModule } from './modules/substrate.module'
import { VaultModule } from './modules/vault.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [substrateConfig],
    }),
    VaultModule,
    TypeOrmModule.forRoot(databaseConfig),
    UsersModule,
    AuthModule,
    EthereumModule,
    SubstrateModule,
  ],
})
export class AppModule {}
