import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { Repository } from 'typeorm'
import { EthereumService } from './ethereum.service'
import { VaultService } from './vault.service'
import { Transaction } from '../entities/transaction.entity'

// Константы для моков
const MOCK_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890'
const MOCK_TX_HASH = '0xabcdef1234567890'

// Мок для ethers
jest.mock('ethers', () => {
  return {
    Wallet: jest.fn().mockImplementation(() => ({
      address: MOCK_WALLET_ADDRESS,
      sendTransaction: jest.fn().mockResolvedValue({
        hash: MOCK_TX_HASH,
        wait: jest.fn().mockResolvedValue({}),
      }),
    })),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(BigInt(10000000000000000000)), // 10 ETH
    })),
    parseEther: jest.fn().mockImplementation(() => BigInt(1000000000000000000)), // 1 ETH
    formatEther: jest.fn().mockReturnValue('10.0'),
  }
})

// Мокаем зависимости
const mockVaultService = {
  getSecret: jest.fn(),
}

const mockConfigService = {
  get: jest.fn(),
}

const mockTransactionRepository = {
  create: jest.fn(),
  save: jest.fn(),
}

describe('EthereumService', () => {
  let service: EthereumService
  let vaultService: VaultService
  let transactionRepository: Repository<Transaction>

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EthereumService,
        {
          provide: VaultService,
          useValue: mockVaultService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
      ],
    }).compile()

    service = module.get<EthereumService>(EthereumService)
    vaultService = module.get<VaultService>(VaultService)
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction))
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getUserWallet', () => {
    it('should get a wallet for a regular user', async () => {
      // Setup
      mockVaultService.getSecret.mockResolvedValue({
        privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      })

      // Execute
      const wallet = await service.getUserWallet('user@example.com', false)

      // Assert
      expect(vaultService.getSecret).toHaveBeenCalledWith('secret/ethereum/user@example.com')
      expect(wallet).toBeDefined()
      expect(wallet.address).toBe(MOCK_WALLET_ADDRESS)
    })

    it('should get a wallet for an OAuth user', async () => {
      // Setup
      mockVaultService.getSecret.mockResolvedValue({
        privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      })

      // Execute
      const wallet = await service.getUserWallet('user@example.com', true)

      // Assert
      expect(vaultService.getSecret).toHaveBeenCalledWith('secret/ethereum/oauth_user@example.com')
      expect(wallet).toBeDefined()
      expect(wallet.address).toBe(MOCK_WALLET_ADDRESS)
    })

    it('should throw an error if private key is not found', async () => {
      // Setup
      mockVaultService.getSecret.mockResolvedValue(null)

      // Assert
      await expect(service.getUserWallet('user@example.com')).rejects.toThrow(
        'Private key not found for user@example.com'
      )
    })
  })

  describe('sendNative', () => {
    it('should send a transaction and save it to the database', async () => {
      // Setup
      mockVaultService.getSecret.mockResolvedValue({
        privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      })

      mockTransactionRepository.create.mockReturnValue({
        userAddress: MOCK_WALLET_ADDRESS,
        txHash: MOCK_TX_HASH,
        amount: '1.0',
        toAddress: '0x0987654321098765432109876543210987654321',
      })

      // Execute
      const result = await service.sendNative(
        'user@example.com',
        '0x0987654321098765432109876543210987654321',
        '1.0'
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.hash).toBe(MOCK_TX_HASH)
      expect(transactionRepository.create).toHaveBeenCalledWith({
        userAddress: MOCK_WALLET_ADDRESS,
        txHash: MOCK_TX_HASH,
        amount: '1.0',
        toAddress: '0x0987654321098765432109876543210987654321',
      })
      expect(transactionRepository.save).toHaveBeenCalled()
    })
  })

  describe('getBalance', () => {
    it('should return the balance of an address', async () => {
      // Execute
      const balance = await service.getBalance(MOCK_WALLET_ADDRESS)

      // Assert
      expect(balance).toBe('10.0')
    })
  })
})
