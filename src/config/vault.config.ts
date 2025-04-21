import { VaultOptions } from 'node-vault'

/**
 * Configuration for connecting to HashiCorp Vault.
 * This specifies the connection parameters to the Vault server.
 */
export const vaultConfig: VaultOptions = {
  endpoint: process.env.VAULT_ENDPOINT || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN || 'dev-only-token',
}
