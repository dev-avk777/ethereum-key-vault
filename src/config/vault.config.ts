import { VaultOptions } from 'node-vault'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Module } from '@nestjs/common'

/**
 * Configuration for connecting to HashiCorp Vault.
 * This specifies the connection parameters to the Vault server.
 */
export const vaultConfig: VaultOptions = {
  endpoint: process.env.VAULT_ENDPOINT || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN || 'dev-only-token',
}

/**
 * ConfigModule registration for Vault configuration.
 * This allows injecting the configuration using DI.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'VAULT_CONFIG',
      useFactory: (configService: ConfigService) => ({
        endpoint: configService.get<string>('VAULT_ENDPOINT') || 'http://127.0.0.1:8200',
        token: configService.get<string>('VAULT_TOKEN') || 'dev-only-token',
      }),
      inject: [ConfigService],
    },
  ],
  exports: ['VAULT_CONFIG'],
})
export class VaultConfigModule {}
