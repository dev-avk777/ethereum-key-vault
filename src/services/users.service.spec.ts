import { Test, TestingModule } from '@nestjs/testing'
import { UsersService } from './users.service'
import { VaultService } from './vault.service'
import { getRepositoryToken } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'
import * as argon2 from 'argon2'
import { Wallet } from 'ethers'
import { CreateUserDto } from '../dto/create-user.dto'
import { NotFoundException, InternalServerErrorException } from '@nestjs/common'

// Mock external dependencies
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  verify: jest.fn(),
}))

jest.mock('ethers', () => ({
  Wallet: {
    createRandom: jest.fn().mockReturnValue({
      privateKey: '0xprivateKey',
      address: '0xpublicAddress',
    }),
  },
}))

describe('UsersService', () => {
  let service: UsersService
  let vaultService: jest.Mocked<VaultService>
  let userRepository: jest.Mocked<Repository<User>>

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedPassword',
    publicKey: '0x123',
    createdAt: new Date(),
    googleId: null,
    displayName: null,
  }

  beforeEach(async () => {
    vaultService = {
      storeSecret: jest.fn().mockResolvedValue({ data: {} }),
      getSecret: jest.fn().mockResolvedValue({ privateKey: '0xprivateKey' }),
      generateKeyPair: jest.fn().mockResolvedValue({
        privateKey: '0xprivateKey',
        publicKey: '0xpublicAddress',
      }),
    } as unknown as jest.Mocked<VaultService>

    userRepository = {
      create: jest.fn().mockReturnValue(mockUser),
      save: jest.fn().mockResolvedValue(mockUser),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: VaultService,
          useValue: vaultService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('registerUser', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'password123',
    }

    const mockWallet = {
      privateKey: '0xprivateKey',
      address: '0xpublicAddress',
    }

    it('should register a new user successfully', async () => {
      const result = await service.registerUser(createUserDto)

      expect(argon2.hash).toHaveBeenCalledWith(createUserDto.password)
      expect(Wallet.createRandom).toHaveBeenCalled()
      expect(vaultService.storeSecret).toHaveBeenCalledWith(
        `secret/ethereum/${createUserDto.email}`,
        { privateKey: mockWallet.privateKey }
      )
      expect(userRepository.create).toHaveBeenCalledWith({
        email: createUserDto.email,
        password: 'hashedPassword',
        publicKey: mockWallet.address,
      })
      expect(userRepository.save).toHaveBeenCalledWith(mockUser)
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        publicKey: mockUser.publicKey,
      })
    })
  })

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      userRepository.findOne.mockResolvedValue(mockUser)

      const result = await service.findByEmail('test@example.com')

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
      expect(result).toEqual(mockUser)
    })

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null)

      const result = await service.findByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })
  })

  describe('validateUser', () => {
    beforeEach(() => {
      userRepository.findOne.mockResolvedValue(mockUser)
    })

    it('should validate user with correct credentials', async () => {
      ;(argon2.verify as jest.Mock).mockResolvedValue(true)

      const result = await service.validateUser('test@example.com', 'password123')

      expect(result).toEqual(mockUser)
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.password, 'password123')
    })

    it('should return undefined with incorrect credentials', async () => {
      ;(argon2.verify as jest.Mock).mockResolvedValue(false)

      const result = await service.validateUser('test@example.com', 'wrongpassword')

      expect(result).toBeUndefined()
    })

    it('should return undefined when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null)

      const result = await service.validateUser('nonexistent@example.com', 'password123')

      expect(result).toBeUndefined()
    })
  })

  describe('findById', () => {
    it('should find user by ID', async () => {
      userRepository.findOne.mockResolvedValue(mockUser)

      const result = await service.findById('123')

      expect(result).toEqual(mockUser)
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: '123' } })
    })

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null)

      const result = await service.findById('nonexistent-id')

      expect(result).toBeNull()
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'nonexistent-id' } })
    })
  })

  describe('getSubstrateAddress', () => {
    it('should convert ethereum address to substrate address', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        publicKey: '0x1234567890123456789012345678901234567890',
        password: 'hashedPassword',
        googleId: null,
        displayName: null,
        createdAt: new Date(),
      }

      userRepository.findOne.mockResolvedValue(mockUser)

      const result = await service.getSubstrateAddress('test@example.com')
      expect(result).toBeDefined()
      expect(result).toMatch(/^5[1-9A-HJ-NP-Za-km-z]{47}$/) // Substrate address format
    })

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null)

      await expect(service.getSubstrateAddress('nonexistent@example.com')).rejects.toThrow(
        NotFoundException
      )
    })

    it('should throw InternalServerErrorException when conversion fails', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        publicKey: 'invalid-eth-address',
        password: 'hashedPassword',
        googleId: null,
        displayName: null,
        createdAt: new Date(),
      }

      userRepository.findOne.mockResolvedValue(mockUser)

      await expect(service.getSubstrateAddress('test@example.com')).rejects.toThrow(
        InternalServerErrorException
      )
    })
  })
})
