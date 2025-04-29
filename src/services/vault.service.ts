import { Injectable, Logger, Inject, Scope, OnModuleInit } from '@nestjs/common'
import { Wallet } from 'ethers'
import * as vault from 'node-vault'
import { VaultOptions } from 'node-vault'

export interface IVaultService {
  storeSecret(path: string, secret: Record<string, any>): Promise<any>
  getSecret(path: string): Promise<any>
}

@Injectable({ scope: Scope.DEFAULT })
export class RealVaultService implements IVaultService, OnModuleInit {
  private readonly logger = new Logger(RealVaultService.name)
  private vaultClient: vault.client

  constructor(@Inject('VAULT_CONFIG') private readonly vaultConfig: VaultOptions) {
    this.vaultClient = vault(vaultConfig)
    this.logger.log(`Initialized Vault client with endpoint: ${vaultConfig.endpoint}`)
  }
  async onModuleInit() {
    try {
      const mounts = await this.vaultClient.read('sys/mounts/secret')
      const opts = mounts.data.options as Record<string, any>
      if (opts.version !== '2' && opts.version !== 2) {
        this.logger.log('Remounting secret/ to KV v2')
        await this.vaultClient.request({
          method: 'POST',
          path: 'sys/mounts/secret',
          json: {
            type: 'kv',
            options: { version: 2 },
          },
        })
      } else {
        this.logger.log('secret/ already KV v2')
      }
    } catch (e: unknown) {
      console.log(e)
      // Если не монтировано вообще — просто устраиваем его
      this.logger.log('Mounting secret/ to KV v2')
      await this.vaultClient.request({
        method: 'POST',
        path: 'sys/mounts/secret',
        json: {
          type: 'kv',
          options: { version: 2 },
        },
      })
    }
  }
  async storeSecret(path: string, secret: Record<string, any>) {
    this.logger.debug(`Storing secret at "${path}"`)
    try {
      return await this.vaultClient.write(`secret/data/${path}`, { data: secret })
    } catch (error: unknown) {
      this.logger.error(
        `Failed to store secret at "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      throw new Error(
        `Failed to store secret: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getSecret(path: string) {
    this.logger.debug(`Retrieving secret at "${path}"`)
    try {
      const result = await this.vaultClient.read(`secret/data/${path}`)
      return result?.data?.data || null
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to retrieve secret at "${path}": ${msg}`)
      if (msg.includes('Key not found')) {
        return null
      }
      throw new Error(`Failed to get secret: ${msg}`)
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

  async storeSecret(path: string, secret: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[Vault] Storing secret at "${path}": ${JSON.stringify(secret)}`)
    }
    this.memoryStore[path] = secret
    return { success: true }
  }

  async getSecret(path: string) {
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

  async storeSecret(path: string, secret: Record<string, any>) {
    return this.vaultServiceImpl.storeSecret(path, secret)
  }

  async getSecret(path: string) {
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
