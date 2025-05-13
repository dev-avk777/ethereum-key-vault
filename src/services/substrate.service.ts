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
    this.ss58Prefix = this.configService.get<number>('substrate.ss58Prefix') ?? 42
  }

  /**
   * Initializes the connection to the Substrate node.
   * @returns {Promise<void>} A promise that resolves when the connection is established.
   */
  async onModuleInit() {
    const url = this.configService.get<string>('substrate.rpcUrl') || 'ws://127.0.0.1:9944'
    const provider = new WsProvider(url)
    this.api = await ApiPromise.create({ provider })
    this.logger.log(`Connected to Substrate node at ${url}`)

    // Логгирование важных конфигурационных параметров
    const tokenId = this.configService.get<string>('substrate.tokenId')
    const useBalances = this.configService.get<boolean>('substrate.useBalances')
    this.logger.log(`Substrate configuration: tokenId=${tokenId}, useBalances=${useBalances}`)

    // Проверяем доступные методы трансфера
    const hasTokensTransfer = !!this.api.tx.tokens?.transfer
    const hasBalancesTransfer = !!this.api.tx.balances?.transfer
    this.logger.log(
      `Available transfer methods: tokens.transfer=${hasTokensTransfer}, balances.transfer=${hasBalancesTransfer}`
    )

    // Проверка наличия подходящих методов трансфера
    if (!hasTokensTransfer && !hasBalancesTransfer) {
      this.logger.warn(
        'No suitable transfer methods found on this chain. Fungible token transfers may not work!'
      )
    }
  }

  /**
   * Generates a new SR25519 key pair, stores the mnemonic in Vault, and returns the SS58 address.
   * @param {string} userId - The ID of the user for whom the wallet is generated.
   * @returns {Promise<{ address: string; privateKey: string }>} A promise that resolves to an object containing the generated address and privateKey.
   */
  async generateWallet(userId: string): Promise<{ address: string; privateKey: string }> {
    this.logger.log(`GenerateWallet called for user ${userId}`)

    try {
      const mnemonic = mnemonicGenerate()
      this.logger.log(`Mnemonic generated successfully`)

      const keyring = new Keyring({ type: 'sr25519' })
      const pair = keyring.addFromUri(mnemonic)
      this.logger.log(`Keyring pair created successfully`)

      // Use ss58Prefix instead of substrateRpcUrl
      const address = encodeAddress(pair.publicKey, this.ss58Prefix)
      this.logger.log(`Address encoded successfully: ${address}`)

      // Прямой вызов storeSecret без try/catch
      this.logger.log(`Storing secret at substrate/${userId}`)
      await this.vaultService.storeSecret(`substrate/${userId}`, { privateKey: mnemonic })
      this.logger.log(`Secret stored successfully for user ${userId}`)

      this.logger.log(`Generated Substrate wallet for user ${userId}: ${address}`)
      return { address, privateKey: mnemonic }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available'

      this.logger.error(`Failed to generate wallet for user ${userId}: ${errorMessage}`)
      this.logger.error(`Error stack: ${errorStack}`)
      throw error // Перебрасываем ошибку для обработки на уровне выше
    }
  }

  /**
   * Sends tokens universally by selecting the appropriate extrinsic based on chain capability.
   * @param {string} userId - The ID of the user sending tokens.
   * @param {string} to - The recipient's address.
   * @param {string} amount - The amount of tokens to send (in human readable format).
   * @param {string} assetIdOverride - Optional asset ID override for ORML tokens.
   * @returns {Promise<{ hash: string }>} A promise that resolves to an object containing the transaction hash.
   * @throws {BadRequestException} If there is no privateKey in Vault for the user or if the transfer fails.
   * @throws {InternalServerErrorException} If no suitable transfer method is found on the chain.
   */
  async sendTokens(
    userId: string,
    to: string,
    amount: string,
    assetIdOverride?: string
  ): Promise<{ hash: string }> {
    if (!this.api) {
      await this.onModuleInit()
    }

    // 1) Достанем приватный ключ
    const secret = await this.vaultService.getSecret(`substrate/${userId}`)
    if (!secret?.privateKey) {
      throw new BadRequestException(`No private key for user ${userId}`)
    }
    const pair = new Keyring({ type: 'sr25519' }).addFromUri(secret.privateKey)

    // 2) Конвертируем amount в планки
    const amountPlanck = parseBalance(this.api, amount)

    // 3) Выбираем extrinsic
    let tx
    const assetId = assetIdOverride ?? this.configService.get<string>('substrate.tokenId')
    const useBalances = this.configService.get<boolean>('substrate.useBalances')

    this.logger.debug(`Has api.tx.tokens.transfer? ${!!this.api.tx.tokens?.transfer}`)
    this.logger.debug(`Has api.tx.balances.transfer? ${!!this.api.tx.balances?.transfer}`)
    this.logger.debug(`Has api.tx.unique.transfer? ${!!this.api.tx.unique?.transfer}`)
    this.logger.debug(`Config useBalances: ${useBalances}`)
    this.logger.debug(`Using asset ID: ${assetId}`)

    // A) ORML-tokens (если доступны и useBalances=false)
    if (this.api.tx.tokens?.transfer && !useBalances) {
      this.logger.debug(`Using tokens.transfer for asset ${assetId}`)
      tx = this.api.tx.tokens.transfer(assetId, to, amountPlanck)

      // B) Классический balances
    } else if (this.api.tx.balances?.transfer) {
      this.logger.debug(`Using balances.transfer`)
      tx = this.api.tx.balances.transfer(to, amountPlanck)

      // C) Для сети Unique Network используем unique.transfer с правильными аргументами
    } else if (this.api.tx.unique?.transfer) {
      const argNames = this.api.tx.unique.transfer.meta.args.map(arg => arg.name.toString())
      this.logger.debug(`unique.transfer expects args: [${argNames.join(', ')}]`)
      this.logger.debug(`Using unique.transfer for Unique Network`)

      try {
        // Получаем коллекцию по умолчанию - обычно 0 для нативных токенов
        const collectionId = 0
        const itemId = 0 // Обычно 0 для нативных токенов

        // Форматируем адрес получателя в правильный формат для Unique Network
        const recipient = this.formatRecipientForUnique(to)
        if (!recipient) {
          throw new BadRequestException(
            'Invalid recipient address format - must be either Substrate (5...) or Ethereum (0x...) address'
          )
        }

        // Создаем транзакцию
        this.logger.debug(
          `unique.transfer with args: recipient=${JSON.stringify(recipient)}, collectionId=${collectionId}, itemId=${itemId}, value=${amountPlanck}`
        )
        tx = this.api.tx.unique.transfer(recipient, collectionId, itemId, amountPlanck)

        // Проверяем баланс отправителя
        const account = (await this.api.query.system.account(
          pair.address
        )) as unknown as AccountInfo
        const balance = BigInt(account.data.free.toString())

        // Получаем информацию о комиссии
        const info = await tx.paymentInfo(pair)
        const fee = BigInt(info.partialFee.toString())

        // Проверяем, достаточно ли средств для транзакции + комиссии
        const totalNeeded = BigInt(amountPlanck.toString()) + fee
        if (balance < totalNeeded) {
          const formatBalance = (n: bigint) =>
            this.api.createType('Balance', n.toString()).toHuman()
          throw new BadRequestException(
            `Insufficient funds. You have ${formatBalance(balance)}, ` +
              `need ${formatBalance(BigInt(amountPlanck.toString()))} + ${formatBalance(fee)} fee = ${formatBalance(totalNeeded)}`
          )
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.error(`Failed to create unique.transfer transaction: ${errorMessage}`)
        throw new BadRequestException(`Error creating transaction: ${errorMessage}`)
      }

      // D) Нет подходящих методов трансфера
    } else {
      this.logger.error(`No suitable transfer method found on this chain`)
      throw new InternalServerErrorException(
        'No suitable fungible transfer method found on this chain. Please check if tokens.transfer or balances.transfer are available.'
      )
    }

    // 4) Отправляем
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
    this.logger.debug(`Raw account info for ${pair.address}: ${JSON.stringify(account)}`)
    const freePlanck = account.data.free.toString()
    this.logger.debug(`Free balance in planck: ${freePlanck}`)

    // --- ВСТАВЛЯЕМ ЛОГ: форматируем баланс в человекочитаемом виде
    const formatted = formatBalance(this.api, account)
    this.logger.debug(`Formatted balance: ${formatted}`)

    return formatted
  }

  /**
   * Helper method to detect if an address is a Substrate address
   * @param address The address to check
   * @returns boolean indicating if this is a Substrate address
   */
  private isSubstrateAddress(address: string): boolean {
    return address.startsWith('5')
  }

  /**
   * Helper method to detect if an address is an Ethereum address
   * @param address The address to check
   * @returns boolean indicating if this is an Ethereum address
   */
  private isEthereumAddress(address: string): boolean {
    return address.toLowerCase().startsWith('0x')
  }

  /**
   * Format recipient address for Unique Network transfer
   * @param address The recipient address
   * @returns Formatted recipient object or null if invalid
   */
  private formatRecipientForUnique(
    address: string
  ): { Substrate: string } | { Ethereum: string } | null {
    if (this.isSubstrateAddress(address)) {
      return { Substrate: address }
    }
    if (this.isEthereumAddress(address)) {
      return { Ethereum: address }
    }
    return null
  }
}
