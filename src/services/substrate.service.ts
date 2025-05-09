import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { Keyring } from '@polkadot/keyring'
import { mnemonicGenerate, encodeAddress } from '@polkadot/util-crypto'
import { IWalletService } from './wallet.interface'
import { VaultService } from './vault.service'
import { AccountInfo } from '@polkadot/types/interfaces'
import { formatBalance, parseBalance } from '../utils/substrate.utils'

@Injectable()
/**
 * SubstrateService handles wallet operations for Substrate-based blockchain.
 */
export class SubstrateService implements IWalletService, OnModuleInit {
  private api: ApiPromise
  private readonly logger = new Logger(SubstrateService.name)
  private readonly ss58Prefix: number

  constructor(
    private readonly configService: ConfigService,
    private readonly vaultService: VaultService
  ) {
    // Set the ss58Prefix from the config, defaulting to 42
    this.ss58Prefix = this.configService.get<number>('SUBSTRATE_SS58_PREFIX') ?? 42
  }

  /**
   * Initializes the connection to the Substrate node.
   * @returns {Promise<void>} A promise that resolves when the connection is established.
   */
  async onModuleInit() {
    const url = this.configService.get<string>('SUBSTRATE_RPC_URL') || 'ws://127.0.0.1:9944'
    const provider = new WsProvider(url)
    this.api = await ApiPromise.create({ provider })
    this.logger.log(`Connected to Substrate node at ${url}`)
  }

  /**
   * Generates a new SR25519 key pair, stores the mnemonic in Vault, and returns the SS58 address.
   * @param {string} userId - The ID of the user for whom the wallet is generated.
   * @returns {Promise<{ address: string; privateKey: string }>} A promise that resolves to an object containing the generated address and privateKey.
   */
  async generateWallet(userId: string): Promise<{ address: string; privateKey: string }> {
    const mnemonic = mnemonicGenerate()
    const keyring = new Keyring({ type: 'sr25519' })
    const pair = keyring.addFromUri(mnemonic)

    // Use ss58Prefix instead of substrateRpcUrl
    const address = encodeAddress(pair.publicKey, this.ss58Prefix)

    await this.vaultService.storeSecret(`substrate/${userId}`, { privateKey: mnemonic })

    this.logger.log(`Generated Substrate wallet for user ${userId}: ${address}`)
    return { address, privateKey: mnemonic }
  }

  /**
   * Sends tokens using balances.transfer and waits for inclusion in a block.
   * @param {string} userId - The ID of the user sending tokens.
   * @param {string} to - The recipient's address.
   * @param {string} amount - The amount of tokens to send.
   * @returns {Promise<{ hash: string }>} A promise that resolves to an object containing the transaction hash.
   * @throws {BadRequestException} If there is no privateKey in Vault for the user or if the transfer fails.
   */
  async sendTokens(userId: string, to: string, amount: string): Promise<{ hash: string }> {
    if (!this.api) {
      await this.onModuleInit()
    }

    const secret = await this.vaultService.getSecret(`substrate/${userId}`)
    if (!secret?.privateKey) {
      throw new BadRequestException(`No private key for user ${userId}`)
    }

    const keyring = new Keyring({ type: 'sr25519' })
    const pair = keyring.addFromUri(secret.privateKey)
    const amountPlanck = parseBalance(this.api, amount)
    this.logger.debug(`Has api.tx.unique.transfer? ${!!this.api.tx.unique?.transfer}`)
    this.logger.debug(`Has api.tx.tokens.transfer? ${!!this.api.tx.tokens?.transfer}`)
    this.logger.debug(`Has api.tx.balances.transfer? ${!!this.api.tx.balances?.transfer}`)
    let tx
    if (this.api.tx.unique?.transfer) {
      // если у вас кастомная паллета unique:
      tx = this.api.tx.unique.transfer(to, amountPlanck)
    } else if (this.api.tx.tokens?.transfer) {
      // ORML-паллета tokens: первый аргумент — идентификатор валюты, чаще всего строка "OPAL"
      tx = this.api.tx.tokens.transfer('OPAL', to, amountPlanck)
    } else {
      throw new InternalServerErrorException('No suitable transfer method found on this chain')
    }

    return new Promise((resolve, reject) => {
      tx.signAndSend(pair, ({ status, dispatchError, txHash }) => {
        if (dispatchError) {
          return reject(new BadRequestException(dispatchError.toString()))
        }
        if (status.isInBlock) {
          resolve({ hash: txHash.toHex() })
        }
      }).catch(err => reject(new BadRequestException(err.message)))
    })
  }

  /**
   * Returns the native token balance for the user.
   * @param userId
   * @throws {InternalServerErrorException} If there is an error accessing Vault
   * @throws {NotFoundException} If there is no saved privateKey in Vault
   */
  async getBalance(userId: string): Promise<string> {
    if (!this.api) {
      await this.onModuleInit()
    }

    let secret: { privateKey?: string } | null
    try {
      secret = await this.vaultService.getSecret(`substrate/${userId}`)
    } catch (err) {
      const errorMessage = (err as Error).message
      this.logger.error(`Vault error for user ${userId}: ${errorMessage}`)
      if (errorMessage.includes('Status 404')) {
        throw new NotFoundException('No saved mnemonic for user')
      }
      throw new InternalServerErrorException('Error accessing Vault')
    }

    // If nothing is found in Vault, return a clear 404
    if (!secret || !secret.privateKey) {
      throw new NotFoundException(`No saved mnemonic for user ${userId}`)
    }

    const keyring = new Keyring({ type: 'sr25519' })
    const pair = keyring.addFromUri(secret.privateKey)

    const account = (await this.api.query.system.account(pair.address)) as unknown as AccountInfo

    return formatBalance(this.api, account)
  }
}
