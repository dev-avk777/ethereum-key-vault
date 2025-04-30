import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException } from '@nestjs/common'
import { Repository } from 'typeorm'
import { ethers } from 'ethers'
import { EthereumService } from './ethereum.service'
import { VaultService } from './vault.service'
import { Transaction } from '../entities/transaction.entity'
import { ConfigService } from '@nestjs/config'
import { User } from '../entities/user.entity'
/**
 * Unit tests for EthereumService.
 *
 * Covers:
 * - getUserWallet: fetching wallet and handling missing key
 * - sendNative: invalid amount, invalid address, insufficient funds, success
 * - getBalance: valid balance, invalid address
 */

// Mocks
const mockVaultService = { getSecret: jest.fn() } as unknown as VaultService
const mockTransactionRepo = {
  create: jest.fn(),
  save: jest.fn(),
} as unknown as Repository<Transaction>
const mockUserRepo = {
  findOne: jest.fn(),
} as unknown as Repository<User>
const mockConfigService = {
  get: jest.fn().mockReturnValue('https://rpc-opal.unique.network'),
} as unknown as ConfigService

// Constants for mocks
const MOCK_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890'
const MOCK_TX_HASH = '0xabcdef1234567890'

// Mock ethers module to match import { ethers } from 'ethers'
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers')
  return {
    ...actual,
    ethers: {
      Wallet: jest.fn().mockImplementation(() => ({
        address: MOCK_WALLET_ADDRESS,
        sendTransaction: jest.fn().mockResolvedValue({
          hash: MOCK_TX_HASH,
          wait: jest.fn().mockResolvedValue({ blockNumber: 123 }),
        }),
      })),
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        getBalance: jest.fn().mockResolvedValue(BigInt(5e17)), // 0.5 ETH
      })),

      parseEther: jest.fn().mockImplementation(
        (amt: string) => (amt === '0' ? 0n : BigInt(1e18)) // 1 ETH для любых ненулевых строк
      ),
      formatEther: jest.fn().mockReturnValue('0.5'),
      isAddress: jest.fn().mockImplementation((addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr)),
    },
  }
})

describe('EthereumService', () => {
  let service: EthereumService
  let vaultService: VaultService
  let transactionRepo: Repository<Transaction>
  let _userRepository: Repository<User>

  beforeEach(async () => {
    jest.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EthereumService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: VaultService, useValue: mockVaultService },
        { provide: getRepositoryToken(Transaction), useValue: mockTransactionRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile()

    service = module.get<EthereumService>(EthereumService)
    vaultService = module.get<VaultService>(VaultService)
    transactionRepo = module.get<Repository<Transaction>>(getRepositoryToken(Transaction))
    _userRepository = module.get<Repository<User>>(getRepositoryToken(User))
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getUserWallet', () => {
    it('returns a Wallet when privateKey found', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' } as User
      ;(mockUserRepo.findOne as jest.Mock).mockResolvedValue(mockUser)
      ;(vaultService.getSecret as jest.Mock).mockResolvedValue({
        privateKey: '0x' + 'a'.repeat(64),
      })
      const wallet = await service.getUserWallet('user@example.com')
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { email: 'user@example.com' } })
      expect(vaultService.getSecret).toHaveBeenCalledWith(`secret/ethereum/${mockUser.id}`)
      expect(wallet.address).toBe(MOCK_WALLET_ADDRESS)
    })

    it('throws BadRequestException when user not found', async () => {
      ;(mockUserRepo.findOne as jest.Mock).mockResolvedValue(null)
      await expect(service.getUserWallet('user@example.com')).rejects.toThrow(BadRequestException)
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { email: 'user@example.com' } })
    })

    it('throws BadRequestException when secret missing', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' } as User
      ;(mockUserRepo.findOne as jest.Mock).mockResolvedValue(mockUser)
      ;(vaultService.getSecret as jest.Mock).mockResolvedValue(null)
      await expect(service.getUserWallet('user@example.com')).rejects.toThrow(BadRequestException)
    })
  })

  describe('sendNative', () => {
    beforeEach(() => {
      ;(vaultService.getSecret as jest.Mock).mockResolvedValue({
        privateKey: '0x' + 'a'.repeat(64),
      })
    })

    it('throws on zero amount', async () => {
      await expect(
        service.sendNative('user@example.com', MOCK_WALLET_ADDRESS, '0')
      ).rejects.toThrow(BadRequestException)
    })

    it('throws on invalid to address', async () => {
      ;(ethers.isAddress as unknown as jest.Mock).mockReturnValueOnce(false)
      await expect(service.sendNative('user@example.com', 'invalid', '1')).rejects.toThrow(
        BadRequestException
      )
    })

    it('throws on insufficient funds', async () => {
      await expect(
        service.sendNative('user@example.com', MOCK_WALLET_ADDRESS, '1')
      ).rejects.toThrow(BadRequestException)
    })

    it('succeeds and saves transaction', async () => {
      ;(ethers.parseEther as unknown as jest.Mock).mockReturnValueOnce(BigInt(1e17))
      ;(mockTransactionRepo.create as unknown as jest.Mock).mockReturnValue({
        userAddress: MOCK_WALLET_ADDRESS,
        txHash: MOCK_TX_HASH,
        amount: '0.1',
        toAddress: MOCK_WALLET_ADDRESS,
      })
      const tx = await service.sendNative('user@example.com', MOCK_WALLET_ADDRESS, '0.1')
      expect(tx.hash).toBe(MOCK_TX_HASH)
      expect(transactionRepo.create).toHaveBeenCalledWith({
        userAddress: MOCK_WALLET_ADDRESS,
        txHash: MOCK_TX_HASH,
        amount: '0.1',
        toAddress: MOCK_WALLET_ADDRESS,
      })
      expect(transactionRepo.save).toHaveBeenCalled()
    })
  })

  describe('getBalance', () => {
    it('returns formatted balance on valid address', async () => {
      const balance = await service.getBalance(MOCK_WALLET_ADDRESS)
      expect(balance).toBe('0.5')
    })

    it('throws BadRequestException on invalid address', async () => {
      await expect(service.getBalance('invalid')).rejects.toThrow(BadRequestException)
    })
  })
})
