import { type VaultOptions } from 'node-vault'

/**
 * Конфигурация для подключения к HashiCorp Vault.
 * Здесь указываются параметры подключения к Vault серверу.
 */
export const vaultConfig: VaultOptions = {
  endpoint: process.env.VAULT_ENDPOINT || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN || 'dev-only-token',
}
