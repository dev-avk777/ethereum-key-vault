import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { EthereumController } from './ethereum.controller'
import { EthereumService } from '../services/ethereum.service'
import { UsersService } from '../services/users.service'
import { VaultService } from '../services/vault.service'
import { Transaction } from '../entities/transaction.entity'
import { User } from '../entities/user.entity'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'

// Mock implementations
const mockEthereumService = {
  sendNative: jest.fn(),
  getBalance: jest.fn(),
}

const mockUsersService = {
  findById: jest.fn(),
  getSubstrateAddress: jest.fn(),
  sendTokensFromUser: jest.fn(),
}

const mockTransactionRepository = {
  find: jest.fn(),
}

const mockUserRepository = {
  findOne: jest.fn(),
}

const mockVaultService = {}

describe('EthereumController', () => {
  let controller: EthereumController
  let ethereumService: jest.Mocked<EthereumService>
  let usersService: jest.Mocked<UsersService>

  beforeEach(async () => {
    jest.clearAllMocks()

    ethereumService = {
      sendNative: jest.fn(),
      getBalance: jest.fn(),
    } as unknown as jest.Mocked<EthereumService>

    usersService = {
      findById: jest.fn(),
      getSubstrateAddress: jest.fn(),
      sendTokensFromUser: jest.fn(),
    } as unknown as jest.Mocked<UsersService>

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EthereumController],
      providers: [
        {
          provide: EthereumService,
          useValue: ethereumService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: VaultService,
          useValue: mockVaultService,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile()

    controller = module.get<EthereumController>(EthereumController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getKeys', () => {
    it('should return the user public key from JWT token', async () => {
      const mockRequest = {
        user: {
          id: 'user-id-1',
          email: 'user@example.com',
          publicKey: '0x1234567890123456789012345678901234567890',
        },
      }

      const result = await controller.getKeys(mockRequest as any)

      expect(result).toEqual([
        {
          id: '1',
          publicKey: '0x1234567890123456789012345678901234567890',
          name: 'Primary Key',
          createdAt: expect.any(String),
        },
      ])
      expect(usersService.findById).not.toHaveBeenCalled()
    })

    it('should fetch the public key from database if not in JWT token', async () => {
      const mockRequest = {
        user: {
          id: 'user-id-1',
          email: 'user@example.com',
        },
      }

      mockUsersService.findById.mockResolvedValue({
        id: 'user-id-1',
        email: 'user@example.com',
        publicKey: '0x1234567890123456789012345678901234567890',
      })

      const result = await controller.getKeys(mockRequest as any)

      expect(result).toEqual([
        {
          id: '1',
          publicKey: '0x1234567890123456789012345678901234567890',
          name: 'Primary Key',
          createdAt: expect.any(String),
        },
      ])
      expect(usersService.findById).toHaveBeenCalledWith('user-id-1')
    })

    it('should throw NotFoundException if user is not found', async () => {
      const mockRequest = {
        user: {
          id: 'user-id-1',
          email: 'user@example.com',
        },
      }

      mockUsersService.findById.mockResolvedValue(null)

      await expect(controller.getKeys(mockRequest as any)).rejects.toThrow(NotFoundException)
    })
  })

  describe('getSubstrateAddress', () => {
    it('should return the substrate address for a user', async () => {
      mockUsersService.getSubstrateAddress.mockResolvedValue(
        '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
      )

      const result = await controller.getSubstrateAddress('user@example.com')

      expect(result).toEqual({
        substrateAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      })
      expect(usersService.getSubstrateAddress).toHaveBeenCalledWith('user@example.com')
    })

    it('should throw NotFoundException if email is not provided', async () => {
      await expect(controller.getSubstrateAddress('')).rejects.toThrow(NotFoundException)
      expect(usersService.getSubstrateAddress).not.toHaveBeenCalled()
    })

    it('should pass through errors from UsersService', async () => {
      mockUsersService.getSubstrateAddress.mockRejectedValue(new Error('User not found'))

      await expect(controller.getSubstrateAddress('user@example.com')).rejects.toThrow(
        'User not found'
      )
    })
  })

  describe('transfer', () => {
    it('should send a transaction and return the hash', async () => {
      const mockUser = {
        id: 'user-id-1',
        email: 'user@example.com',
        googleId: 'google-id-1',
      }

      mockEthereumService.sendNative.mockResolvedValue({
        hash: '0xabcdef1234567890',
      })

      const result = await controller.transfer(mockUser as any, {
        toAddress: '0x0987654321098765432109876543210987654321',
        amount: '1.0',
      })

      expect(result).toEqual({ hash: '0xabcdef1234567890' })
      expect(ethereumService.sendNative).toHaveBeenCalledWith(
        'user@example.com',
        '0x0987654321098765432109876543210987654321',
        '1.0',
        true
      )
    })

    it('should throw UnauthorizedException if user is invalid', async () => {
      await expect(
        controller.transfer(null as any, {
          toAddress: '0x0987654321098765432109876543210987654321',
          amount: '1.0',
        })
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('transferByEmail', () => {
    it('should call UsersService.sendTokensFromUser', async () => {
      const dto = { email: 'a@b.com', toAddress: '0x123', amount: '1' }

      mockUsersService.sendTokensFromUser.mockResolvedValue({
        hash: '0xabcdef1234567890',
      })

      const result = await controller.transferByEmail(dto)

      expect(result).toEqual({ hash: '0xabcdef1234567890' })
      expect(mockUsersService.sendTokensFromUser).toHaveBeenCalledWith('a@b.com', '0x123', '1')
    })
  })

  describe('getTransactions', () => {
    it('should return transactions for an address', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          userAddress: '0x1234567890123456789012345678901234567890',
          txHash: '0xabcdef1234567890',
          amount: '1.0',
          toAddress: '0x0987654321098765432109876543210987654321',
          timestamp: new Date(),
        },
      ]

      mockTransactionRepository.find.mockResolvedValue(mockTransactions)

      const result = await controller.getTransactions('0x1234567890123456789012345678901234567890')

      expect(result).toEqual(mockTransactions)
      expect(mockTransactionRepository.find).toHaveBeenCalledWith({
        where: [
          { userAddress: '0x1234567890123456789012345678901234567890' },
          { toAddress: '0x1234567890123456789012345678901234567890' },
        ],
        order: { timestamp: 'DESC' },
      })
    })

    it('should throw NotFoundException if address is not provided', async () => {
      await expect(controller.getTransactions('')).rejects.toThrow(NotFoundException)
      expect(mockTransactionRepository.find).not.toHaveBeenCalled()
    })
  })
})
