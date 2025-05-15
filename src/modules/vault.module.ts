import { Module } from '@nestjs/common'
import { VaultConfigModule } from '../config/vault.config'
import { VaultServiceProvider, VaultService } from '../services/vault.service'

@Module({
  imports: [VaultConfigModule],
  providers: [VaultServiceProvider, VaultService],
  exports: [VaultService],
})
export class VaultModule {}
