import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { VaultConfigModule } from '../config/vault.config'
import { VaultServiceProvider, VaultService } from '../services/vault.service'
import { EthereumModule } from './ethereum.module'
import { SubstrateModule } from './substrate.module'
import { SubstrateService } from '../services/substrate.service'
import { IWalletService } from '../services/wallet.interface'
import { EthereumService } from '../services/ethereum.service'

@Module({
  imports: [ConfigModule, VaultConfigModule, EthereumModule, SubstrateModule],
  providers: [
    VaultServiceProvider,
    VaultService,
    SubstrateService,
    {
      provide: 'WalletService',
      useFactory: (
        config: ConfigService,
        eth: EthereumService,
        sub: SubstrateService
      ): IWalletService => {
        return config.get<string>('CHAIN_TYPE') === 'substrate' ? sub : eth
      },
      inject: [ConfigService, EthereumService, SubstrateService],
    },
  ],
  exports: ['WalletService'],
})
export class WalletModule {}
