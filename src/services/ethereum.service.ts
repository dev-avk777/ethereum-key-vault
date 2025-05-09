import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ethers } from 'ethers'
import { VaultService } from './vault.service'
import { Transaction } from '../entities/transaction.entity'
import { User } from '../entities/user.entity'
import { IWalletService } from './wallet.interface'

@Injectable()
export class EthereumService implements IWalletService {
  private provider: ethers.JsonRpcProvider
  private readonly logger = new Logger(EthereumService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly vaultService: VaultService,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {
    const rpcUrl =
      this.configService.get<string>('ETHEREUM_RPC_URL') || 'https://rpc-opal.unique.network'
    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    this.logger.log(`Connected to Ethereum node via ${rpcUrl}`)
  }

  /**
   * Generates an Ethereum wallet for a user through VaultService.
   * @param userId - The ID of the user for whom the wallet is generated.
   * @returns An object containing the wallet address and private key.
   */
  async generateWallet(userId: string): Promise<{ address: string; privateKey: string }> {
    const { publicKey, privateKey } = await this.vaultService.generateKeyPair()
    await this.vaultService.storeSecret(`ethereum/${userId}`, { privateKey })
    this.logger.log(`Generated Ethereum wallet for user ${userId}: ${publicKey}`)
    return { address: publicKey, privateKey }
  }

  /**
   * Wrapper around sendNative, conforming to the interface method.
   * @param identifier - The identifier for the transaction.
   * @param to - The recipient address.
   * @param amount - The amount of tokens to send.
   * @returns An object containing the transaction hash.
   */
  async sendTokens(identifier: string, to: string, amount: string): Promise<{ hash: string }> {
    const tx = await this.sendNative(identifier, to, amount)
    return { hash: tx.hash }
  }

  /**
   * Retrieves the user's wallet based on their email.
   * @param email - The email of the user.
   * @returns An instance of ethers.Wallet.
   * @throws BadRequestException if the user or private key is not found.
   */
  async getUserWallet(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    })
    if (!user) {
      this.logger.error(`User not found: ${email}`)
      throw new BadRequestException(`User not found: ${email}`)
    }

    const vaultPath = `secret/ethereum/${user.id}`
    const secret = await this.vaultService.getSecret(vaultPath)
    if (!secret || !secret.privateKey) {
      this.logger.error(`Private key not found for ${email} at ${vaultPath}`)
      throw new BadRequestException(`Private key not found for ${email}`)
    }

    return new ethers.Wallet(secret.privateKey, this.provider)
  }

  /**
   * Sends native ETH to a specified address.
   * @param email - The email of the user sending the ETH.
   * @param to - The recipient address.
   * @param amount - The amount of ETH to send.
   * @param _isOAuth - Optional flag for OAuth (default is false).
   * @returns The transaction object.
   * @throws BadRequestException for various validation errors.
   */
  async sendNative(email: string, to: string, amount: string, _isOAuth = false) {
    try {
      const parsed = ethers.parseEther(amount)
      if (parsed <= 0n) {
        this.logger.warn(`Invalid amount: ${amount}`)
        throw new BadRequestException('Amount must be greater than 0')
      }
      const wallet = await this.getUserWallet(email)
      if (!ethers.isAddress(to)) {
        this.logger.warn(`Invalid destination address: ${to}`)
        throw new BadRequestException('Invalid destination address')
      }
      const balance = await this.provider.getBalance(wallet.address)
      if (balance < parsed) {
        this.logger.warn(`Insufficient funds: have=${ethers.formatEther(balance)}, need=${amount}`)
        throw new BadRequestException('Insufficient funds for this transaction')
      }
      this.logger.log(`[Blockchain] Sending ${amount} ETH from ${wallet.address} → ${to}`)
      const tx = await wallet.sendTransaction({
        to,
        value: parsed,
      })
      tx.wait()
        .then(receipt => {
          if (receipt) {
            this.logger.log(`Confirmed ${tx.hash} in block ${receipt.blockNumber}`)
          } else {
            this.logger.warn(`Transaction ${tx.hash} was not confirmed.`)
          }
        })
        .catch(e => this.logger.error(`Tx failed ${tx.hash}: ${e.message}`))

      const transaction = this.transactionRepository.create({
        userAddress: wallet.address,
        txHash: tx.hash,
        amount,
        toAddress: to,
      })
      await this.transactionRepository.save(transaction)
      this.logger.log(`Saved TX ${tx.hash} for ${wallet.address}`)
      return tx
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      this.logger.error(`Failed to send for ${email}: ${msg}`)
      if (err instanceof BadRequestException || msg.includes('INSUFFICIENT_FUNDS')) {
        throw err instanceof BadRequestException
          ? err
          : new BadRequestException('Insufficient funds for this transaction')
      }
      throw new BadRequestException(`Transaction failed: ${msg}`)
    }
  }

  /**
   * Retrieves the balance of a specified address.
   * @param address - The Ethereum address to check the balance of.
   * @returns The balance in ETH.
   * @throws BadRequestException if the address is invalid or balance retrieval fails.
   */
  async getBalance(address: string) {
    try {
      if (!ethers.isAddress(address)) {
        this.logger.warn(`Invalid address: ${address}`)
        throw new BadRequestException('Invalid address')
      }
      const bal = await this.provider.getBalance(address)
      return ethers.formatEther(bal)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      this.logger.error(`getBalance failed for ${address}: ${msg}`)
      throw new BadRequestException(`Failed to get balance: ${msg}`)
    }
  }
}
