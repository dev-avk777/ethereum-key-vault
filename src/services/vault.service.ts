import { Injectable } from '@nestjs/common'
import { Wallet } from 'ethers'

/**
 * Simplified version of VaultService for testing without connecting to HashiCorp Vault.
 */
@Injectable()
export class VaultService {
  // In-memory store for testing purposes
  private memoryStore: Record<string, any> = {}

  constructor() {}

  /**
   * Generates a new Ethereum key pair.
   * @returns Object with public and private key.
   */
  async generateKeyPair() {
    const wallet = Wallet.createRandom()
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
    this.memoryStore[path] = secret
    return { success: true }
  }

  /**
   * Retrieves a secret from memory (stub).
   * @param path - Path to retrieve the secret.
   */
  async getSecret(path: string) {
    return this.memoryStore[path] || null
  }
}
