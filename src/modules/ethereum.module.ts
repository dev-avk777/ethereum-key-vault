import { forwardRef, Inject, Module, OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { EthereumService } from '../services/ethereum.service'
import { EthereumController } from '../controllers/ethereum.controller'
import { Transaction } from '../entities/transaction.entity'
import { UsersModule } from './users.module'
import { UsersService } from '../services/users.service'

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), ConfigModule, forwardRef(() => UsersModule)],
  providers: [EthereumService],
  controllers: [EthereumController],
  exports: [EthereumService],
})
export class EthereumModule implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly ethereumService: EthereumService
  ) {}

  onModuleInit() {
    // Set up circular dependency between UsersService and EthereumService
    this.usersService.setEthereumService(this.ethereumService)
  }
}
