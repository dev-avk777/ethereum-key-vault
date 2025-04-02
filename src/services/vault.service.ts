import { Injectable, Logger } from '@nestjs/common'
import { ethers } from 'ethers'

/**
 * Упрощенная версия VaultService для тестирования без подключения к HashiCorp Vault.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name)
  private readonly memoryStore: Map<string, any> = new Map()

  constructor() {
    this.logger.warn('Using simplified VaultService - do not use in production!')
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
   * Сохраняет секрет в памяти (заглушка).
   * @param path - Путь для сохранения секрета.
   * @param secret - Объект с данными секрета.
   */
  async storeSecret(path: string, secret: any) {
    this.memoryStore.set(path, secret)
    this.logger.log(`Stored secret at path: ${path} (mock implementation)`)
    return { data: {} }
  }

  /**
   * Получает секрет из памяти (заглушка).
   * @param path - Путь для получения секрета.
   */
  async getSecret(path: string) {
    const secret = this.memoryStore.get(path)
    if (!secret) {
      this.logger.warn(`Secret not found at path: ${path} (mock implementation)`)
      return { privateKey: 'mock-private-key' }
    }
    this.logger.log(`Retrieved secret from path: ${path} (mock implementation)`)
    return secret
  }
}
