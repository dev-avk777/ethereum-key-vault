import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SubstrateService } from '../services/substrate.service'
import { SubstrateController } from '../controllers/substrate.controller'
import { substrateConfig } from '../config/substrate.config'
import { VaultModule } from './vault.module'

@Module({
  imports: [ConfigModule.forFeature(substrateConfig), VaultModule],
  controllers: [SubstrateController],
  providers: [SubstrateService],
  exports: [SubstrateService],
})
export class SubstrateModule {}
