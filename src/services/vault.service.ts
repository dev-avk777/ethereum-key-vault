import { Injectable, Logger, Inject, Scope } from '@nestjs/common'
import { Wallet } from 'ethers'
import * as vault from 'node-vault'
import { VaultOptions } from 'node-vault'

/**
 * Interface for both VaultService implementations
 */
export interface IVaultService {
  storeSecret(path: string, secret: Record<string, any>): Promise<any>
  getSecret(path: string): Promise<any>
}

/**
 * Real VaultService implementation for production use.
 * Uses node-vault library to interact with HashiCorp Vault.
 */
@Injectable({ scope: Scope.DEFAULT })
export class RealVaultService implements IVaultService {
  private readonly logger = new Logger(RealVaultService.name)
  private vaultClient: vault.client

  constructor(@Inject('VAULT_CONFIG') private readonly vaultConfig: VaultOptions) {
    this.vaultClient = vault(vaultConfig)
    this.logger.log(`Initialized Vault client with endpoint: ${vaultConfig.endpoint}`)
  }

  /**
   * Stores a secret in HashiCorp Vault.
   * @param path - Path to store the secret.
   * @param secret - Object with secret data.
   */
  async storeSecret(path: string, secret: Record<string, any>) {
    this.logger.debug(`Storing secret at "${path}"`)
    try {
      return await this.vaultClient.write(path, secret)
    } catch (error: unknown) {
      this.logger.error(
        `Failed to store secret at "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      throw new Error(
        `Failed to store secret: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Retrieves a secret from HashiCorp Vault.
   * @param path - Path to retrieve the secret.
   */
  async getSecret(path: string) {
    this.logger.debug(`Retrieving secret at "${path}"`)
    try {
      const result = await this.vaultClient.read(path)
      return result?.data || null
    } catch (error: unknown) {
      this.logger.error(
        `Failed to retrieve secret at "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      throw new Error(
        `Failed to get secret: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}

/**
 * Memory-based VaultService implementation for testing and development.
 * Stores secrets in memory without requiring a real Vault server.
 */
@Injectable({ scope: Scope.DEFAULT })
export class MemoryVaultService implements IVaultService {
  private readonly logger = new Logger(MemoryVaultService.name)
  // In-memory store for testing purposes
  private memoryStore: Record<string, any> = {}

  /**
   * Generates a new Ethereum key pair.
   * @returns Object with public and private key.
   */
  async generateKeyPair() {
    const wallet = Wallet.createRandom()
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `[Vault] Generated keypair — public: ${wallet.address}, private: ${wallet.privateKey}`
      )
    }
    return {
      publicKey: wallet.address,
      privateKey: wallet.privateKey,
    }
  }

  /**
   * Stores a secret in memory (stub).
   * @param path - Path to store the secret.
   * @param secret - Object with secret data.
   */
  async storeSecret(path: string, secret: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[Vault] Storing secret at "${path}": ${JSON.stringify(secret)}`)
    }

    this.memoryStore[path] = secret
    return { success: true }
  }

  /**
   * Retrieves a secret from memory (stub).
   * @param path - Path to retrieve the secret.
   */
  async getSecret(path: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[Vault] Retrieving secret at "${path}"`)
    }
    return this.memoryStore[path] || null
  }
}

/**
 * Factory to determine which VaultService implementation to use based on environment.
 */
export const VaultServiceProvider = {
  provide: 'VaultServiceImpl',
  useClass: process.env.NODE_ENV === 'production' ? RealVaultService : MemoryVaultService,
}

// Export the alias as the default service for backward compatibility
@Injectable()
export class VaultService implements IVaultService {
  constructor(@Inject('VaultServiceImpl') private vaultServiceImpl: IVaultService) {}

  async storeSecret(path: string, secret: Record<string, any>) {
    return this.vaultServiceImpl.storeSecret(path, secret)
  }

  async getSecret(path: string) {
    return this.vaultServiceImpl.getSecret(path)
  }

  // For backward compatibility
  async generateKeyPair() {
    if (this.vaultServiceImpl instanceof MemoryVaultService) {
      return (this.vaultServiceImpl as MemoryVaultService).generateKeyPair()
    }

    // In production, we generate keypair directly
    const wallet = Wallet.createRandom()
    return {
      publicKey: wallet.address,
      privateKey: wallet.privateKey,
    }
  }
}
