import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import * as vault from 'node-vault'
import { ethers } from 'ethers'

interface VaultSecret {
  [key: string]: string
}

interface VaultResponse {
  data: VaultSecret
}

interface VaultError {
  message: string
}

/**
 * VaultService инкапсулирует логику работы с HashiCorp Vault.
 * Используется для безопасного сохранения приватных ключей Ethereum.
 */
@Injectable()
export class VaultService implements OnModuleInit {
  private client: vault.client
  private readonly logger = new Logger(VaultService.name)

  constructor() {
    if (!process.env.VAULT_ENDPOINT || !process.env.VAULT_TOKEN) {
      this.logger.warn(
        'Vault configuration not found in environment variables. Using default development values.'
      )
    }

    this.client = vault({
      endpoint: process.env.VAULT_ENDPOINT || 'http://127.0.0.1:8200',
      token: process.env.VAULT_TOKEN || 'dev-only-token',
    })
  }

  async onModuleInit() {
    try {
      // Проверяем подключение к Vault при инициализации
      await this.client.status()
      this.logger.log('Successfully connected to Vault server')
    } catch (error) {
      this.logger.warn('Could not connect to Vault server. Some features might be unavailable.')
      if (error instanceof Error) {
        this.logger.debug(error.message)
      }
    }
  }

  /**
   * Генерирует новую пару ключей Ethereum.
   * @returns Объект с публичным и приватным ключом.
   */
  async generateKeyPair() {
    const wallet = ethers.Wallet.createRandom()
    return {
      publicKey: wallet.address,
      privateKey: wallet.privateKey,
    }
  }

  /**
   * Сохраняет секрет по указанному пути.
   * @param path - Путь для сохранения секрета в Vault.
   * @param secret - Объект с данными секрета (например, приватный ключ).
   */
  async storeSecret(path: string, secret: VaultSecret): Promise<VaultResponse> {
    try {
      return await this.client.write(path, secret)
    } catch (error) {
      const vaultError = error as VaultError
      this.logger.error(`Error storing secret at ${path}: ${vaultError.message}`)
      throw error
    }
  }

  /**
   * Получает секрет из Vault по указанному пути.
   * @param path - Путь для получения секрета.
   */
  async getSecret(path: string): Promise<VaultSecret> {
    try {
      const result = await this.client.read(path)
      return result.data
    } catch (error) {
      const vaultError = error as VaultError
      this.logger.error(`Error reading secret from ${path}: ${vaultError.message}`)
      throw error
    }
  }
}
