import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { EthereumService } from '../services/ethereum.service'
import { EthereumController } from '../controllers/ethereum.controller'
import { Transaction } from '../entities/transaction.entity'
import { User } from '../entities/user.entity'
import { UsersModule } from './users.module'
import { VaultModule } from './vault.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, User]),
    ConfigModule,
    VaultModule,
    forwardRef(() => UsersModule),
  ],
  providers: [EthereumService],
  controllers: [EthereumController],
  exports: [EthereumService],
})
export class EthereumModule {}
