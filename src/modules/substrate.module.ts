import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { VaultConfigModule } from '../config/vault.config'
import { VaultServiceProvider, VaultService } from '../services/vault.service'
import { SubstrateService } from '../services/substrate.service'

@Module({
  imports: [ConfigModule, VaultConfigModule],
  providers: [
    VaultServiceProvider, // Registers the implementation of VaultServiceImpl
    VaultService, // The VaultService class itself for injection
    SubstrateService,
  ],
  exports: [SubstrateService],
})
export class SubstrateModule {}
