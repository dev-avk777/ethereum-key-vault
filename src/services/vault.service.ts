import { Injectable, Logger, Inject, Scope } from '@nestjs/common'
import { Wallet } from 'ethers'
import * as vault from 'node-vault'
import { VaultOptions } from 'node-vault'

export interface IVaultService {
  storeSecret(path: string, secret: Record<string, any>): Promise<void>
  getSecret(path: string): Promise<any>
}

@Injectable({ scope: Scope.DEFAULT })
export class RealVaultService implements IVaultService {
  private readonly logger = new Logger(RealVaultService.name)
  private client: ReturnType<typeof vault>
  private readonly mountPoint = 'secret' // точка монтирования в Vault

  constructor(@Inject('VAULT_CONFIG') private readonly cfg: VaultOptions) {
    this.client = vault(cfg)
    this.logger.log(`Vault client инициализирован, точка монтирования: ${this.mountPoint}/`)
  }

  async onModuleInit() {
    // Проверим, что секретная шина именно v2
    try {
      const mounts = await this.client.read(`sys/mounts/${this.mountPoint}`)
      const opts = (mounts.data.options || {}) as Record<string, any>
      if (opts.version !== '2') {
        this.logger.log(`Перемонтирую ${this.mountPoint}/ в KV v2`)
        await this.client.request({
          method: 'POST',
          path: `sys/mounts/${this.mountPoint}`,
          json: { type: 'kv', options: { version: 2 } },
        })
      } else {
        this.logger.log(`${this.mountPoint}/ уже KV v2`)
      }
    } catch (e: unknown) {
      // если не монтировано вовсе
      this.logger.error(e)
      this.logger.log(`Монтирование ${this.mountPoint}/ не найдено, подключаю KV v2`)
      await this.client.request({
        method: 'POST',
        path: `sys/mounts/${this.mountPoint}`,
        json: { type: 'kv', options: { version: 2 } },
      })
    }
  }

  async storeSecret(path: string, secret: Record<string, any>): Promise<void> {
    this.logger.log(`Сохраняю секрет "${path}"`)
    await this.client.write(`${this.mountPoint}/data/${path}`, { data: secret })
    this.logger.log(`Секрет "${path}" сохранён`)
  }

  async getSecret(path: string): Promise<any> {
    try {
      const resp = await this.client.read(`${this.mountPoint}/data/${path}`)
      return resp.data.data
    } catch (e: any) {
      if (e.response?.statusCode === 404) {
        this.logger.warn(`Секрет "${path}" не найден`)
        return null
      }
      throw e
    }
  }
}

@Injectable({ scope: Scope.DEFAULT })
export class MemoryVaultService implements IVaultService {
  private readonly logger = new Logger(MemoryVaultService.name)
  private memoryStore: Record<string, any> = {}

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

  async storeSecret(path: string, secret: Record<string, any>): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[Vault] Storing secret at "${path}": ${JSON.stringify(secret)}`)
    }
    this.memoryStore[path] = secret
  }

  async getSecret(path: string): Promise<any> {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[Vault] Retrieving secret at "${path}"`)
    }
    return this.memoryStore[path] || null
  }
}

export const VaultServiceProvider = {
  provide: 'VaultServiceImpl',
  useClass: RealVaultService,
}

@Injectable()
export class VaultService implements IVaultService {
  constructor(@Inject('VaultServiceImpl') private vaultServiceImpl: IVaultService) {}

  async storeSecret(path: string, secret: Record<string, any>): Promise<void> {
    return this.vaultServiceImpl.storeSecret(path, secret)
  }

  async getSecret(path: string): Promise<any> {
    return this.vaultServiceImpl.getSecret(path)
  }

  async generateKeyPair() {
    if (this.vaultServiceImpl instanceof MemoryVaultService) {
      return (this.vaultServiceImpl as MemoryVaultService).generateKeyPair()
    }
    const wallet = Wallet.createRandom()
    return {
      publicKey: wallet.address,
      privateKey: wallet.privateKey,
    }
  }
}
