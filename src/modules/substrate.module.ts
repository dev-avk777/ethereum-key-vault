import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { VaultConfigModule } from '../config/vault.config'
import { VaultServiceProvider, VaultService } from '../services/vault.service'
import { SubstrateService } from '../services/substrate.service'
import { SubstrateController } from '../controllers/substrate.controller'

@Module({
  imports: [ConfigModule, VaultConfigModule],
  controllers: [SubstrateController],
  providers: [
    VaultServiceProvider, // Registers the implementation of VaultServiceImpl
    VaultService, // The VaultService class itself for injection
    SubstrateService,
  ],
  exports: [SubstrateService],
})
export class SubstrateModule {}
