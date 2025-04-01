import { Injectable, Logger } from '@nestjs/common'
import * as vault from 'node-vault'

/**
 * VaultService инкапсулирует логику работы с HashiCorp Vault.
 * Используется для безопасного сохранения приватных ключей Ethereum.
 */
@Injectable()
export class VaultService {
  private client: any
  private readonly logger = new Logger(VaultService.name)

  constructor() {
    // Инициализация клиента Vault с использованием переменных окружения
    this.client = vault({
      endpoint: process.env.VAULT_ENDPOINT || 'http://127.0.0.1:8200',
      token: process.env.VAULT_TOKEN,
    })
  }

  /**
   * Сохраняет секрет по указанному пути.
   * @param path - Путь для сохранения секрета в Vault.
   * @param secret - Объект с данными секрета (например, приватный ключ).
   */
  async storeSecret(path: string, secret: any): Promise<any> {
    try {
      return await this.client.write(path, secret)
    } catch (error) {
      this.logger.error(`Error storing secret at ${path}: ${error.message}`)
      throw error
    }
  }

  /**
   * Получает секрет из Vault по указанному пути.
   * @param path - Путь для получения секрета.
   */
  async getSecret(path: string): Promise<any> {
    try {
      const result = await this.client.read(path)
      return result.data
    } catch (error) {
      this.logger.error(`Error reading secret from ${path}: ${error.message}`)
      throw error
    }
  }
}
