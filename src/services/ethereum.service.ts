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

  async getUserWallet(email: string) {
    const vaultPath = `secret/ethereum/${email}`
    const secret = await this.vaultService.getSecret(vaultPath)
    if (!secret || !secret.privateKey) {
      this.logger.error(`Private key not found for ${email} at ${vaultPath}`)
      throw new BadRequestException(`Private key not found for ${email}`)
    }
    return new ethers.Wallet(secret.privateKey, this.provider)
  }

  async sendNative(email: string, to: string, amount: string, _isOAuth: boolean = false) {
    try {
      const parsedAmount = ethers.parseEther(amount)
      if (parsedAmount <= 0n) {
        this.logger.warn(`Invalid amount: ${amount}`)
        throw new BadRequestException('Amount must be greater than 0')
      }
      const wallet = await this.getUserWallet(email)
      if (!ethers.isAddress(to)) {
        this.logger.warn(`Invalid destination address: ${to}`)
        throw new BadRequestException('Invalid destination address')
      }
      const balance = await this.provider.getBalance(wallet.address)
      if (balance < parsedAmount) {
        this.logger.warn(
          `Insufficient funds for ${email}: balance=${ethers.formatEther(balance)}, required=${amount}`
        )
        throw new BadRequestException('Insufficient funds for this transaction')
      }
      this.logger.log(`[Blockchain] Sending ${amount} from ${wallet.address} → ${to}`)
      const tx = await wallet.sendTransaction({ to, value: parsedAmount })
      this.logger.log(`Transaction sent: ${tx.hash} - waiting for confirmation...`)
      tx.wait()
        .then(receipt => {
          this.logger.log(`Transaction confirmed: ${tx.hash} (block: ${receipt?.blockNumber})`)
        })
        .catch(error => {
          this.logger.error(`Transaction failed: ${tx.hash} - ${error.message}`)
        })
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
      this.logger.error(
        `Failed to send transaction for ${email}: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      )
      if (error instanceof BadRequestException) {
        throw error
      }
      if (error instanceof Error && error.message.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient funds for this transaction')
      }
      throw new BadRequestException(
        `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      )
    }
  }

  async getBalance(address: string) {
    try {
      if (!ethers.isAddress(address)) {
        this.logger.warn(`Invalid address: ${address}`)
        throw new BadRequestException('Invalid address')
      }
      const balance = await this.provider.getBalance(address)
      return ethers.formatEther(balance)
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get balance for ${address}: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      )
      throw new BadRequestException(
        `Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      )
    }
  }
}
