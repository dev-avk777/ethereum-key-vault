import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ethers } from 'ethers'
import { VaultService } from './vault.service'
import { Transaction } from '../entities/transaction.entity'

@Injectable()
export class EthereumService {
  private provider: ethers.JsonRpcProvider
  private logger = new Logger(EthereumService.name)

  constructor(
    private configService: ConfigService,
    private vaultService: VaultService,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>
  ) {
    const rpcUrl = this.configService.get<string>('RPC_URL') || 'https://rpc-opal.unique.network'
    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    this.logger.log(`Connected to blockchain via ${rpcUrl}`)
  }

  /**
   * Gets a user's wallet by retrieving their private key from Vault
   * @param email - User's email
   * @param isOAuth - Whether the user authenticated via OAuth
   * @returns Ethers wallet instance with provider connected
   */
  async getUserWallet(email: string, isOAuth: boolean = false) {
    const vaultPath = isOAuth ? `secret/ethereum/oauth_${email}` : `secret/ethereum/${email}`
    const secret = await this.vaultService.getSecret(vaultPath)

    if (!secret || !secret.privateKey) {
      throw new Error(`Private key not found for ${email}`)
    }

    return new ethers.Wallet(secret.privateKey, this.provider)
  }

  /**
   * Sends native tokens (ETH/UNQ) from a user's wallet
   * @param email - User's email
   * @param to - Destination address
   * @param amount - Amount to send in Ether units
   * @param isOAuth - Whether the user authenticated via OAuth
   * @returns Transaction data
   */
  async sendNative(email: string, to: string, amount: string, isOAuth: boolean = false) {
    try {
      // Validate amount
      const parsedAmount = ethers.parseEther(amount)
      if (parsedAmount <= 0n) {
        throw new BadRequestException('Amount must be greater than 0')
      }

      const wallet = await this.getUserWallet(email, isOAuth)

      // Check balance
      const balance = await this.provider.getBalance(wallet.address)
      if (balance < parsedAmount) {
        throw new BadRequestException('Insufficient funds for this transaction')
      }

      this.logger.log(`[Blockchain] Sending ${amount} from ${wallet.address} → ${to}`)

      const tx = await wallet.sendTransaction({
        to,
        value: parsedAmount,
      })

      this.logger.log(`Transaction sent: ${tx.hash} - waiting for confirmation...`)

      // Wait for confirmation asynchronously
      tx.wait()
        .then(receipt => {
          this.logger.log(`Transaction confirmed: ${tx.hash} (block: ${receipt?.blockNumber})`)
        })
        .catch(error => {
          this.logger.error(`Transaction failed: ${tx.hash} - ${error.message}`)
        })

      // Save transaction to database immediately
      const transaction = this.transactionRepository.create({
        userAddress: wallet.address,
        txHash: tx.hash,
        amount,
        toAddress: to,
      })

      await this.transactionRepository.save(transaction)

      this.logger.log(`Sent ${amount} tokens from ${wallet.address} to ${to}. Tx hash: ${tx.hash}`)

      return tx
    } catch (error: unknown) {
      // Log the error
      this.logger.error(
        `Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      )

      // Re-throw BadRequestException or wrap other errors
      if (error instanceof BadRequestException) {
        throw error
      }

      if (error instanceof Error && error.message.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient funds for this transaction')
      }

      throw new Error(
        `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      )
    }
  }

  /**
   * Gets the balance of an Ethereum address
   * @param address - Ethereum address
   * @returns Balance in Ether units
   */
  async getBalance(address: string) {
    try {
      const balance = await this.provider.getBalance(address)
      return ethers.formatEther(balance)
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get balance for ${address}: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      )
      throw new Error(
        `Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      )
    }
  }
}
