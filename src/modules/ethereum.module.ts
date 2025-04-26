import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { EthereumService } from '../services/ethereum.service'
import { EthereumController } from '../controllers/ethereum.controller'
import { Transaction } from '../entities/transaction.entity'
import { UsersModule } from './users.module'
import { VaultServiceProvider, VaultService } from '../services/vault.service'
import { VaultConfigModule } from '../config/vault.config'

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    ConfigModule,
    VaultConfigModule,
    forwardRef(() => UsersModule),
  ],
  providers: [EthereumService, VaultServiceProvider, VaultService],
  controllers: [EthereumController],
  exports: [EthereumService],
})
export class EthereumModule {}
