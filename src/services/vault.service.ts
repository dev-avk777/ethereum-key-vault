import { Injectable, Logger } from '@nestjs/common'
import { Wallet } from 'ethers'

/**
 * Simplified version of VaultService for testing without connecting to HashiCorp Vault.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name)
  // In-memory store for testing purposes
  private memoryStore: Record<string, any> = {}

  constructor() {}

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
