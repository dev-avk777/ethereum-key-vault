import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import * as argon2 from 'argon2'
import { Repository } from 'typeorm'
import { CreateUserDto } from '../dto/create-user.dto'
import { User } from '../entities/user.entity'
import { UsersService } from './users.service'
import { VaultService } from './vault.service'

// Mocks
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
  const configServiceMock = { get: jest.fn(() => 'someValue') }

  // Mock for WalletService
  const walletMock = {
    generateWallet: jest.fn().mockResolvedValue({ address: '0xabc', privateKey: '0xprivateKey' }),
    sendTokens: jest.fn().mockResolvedValue({ hash: '0xdeadbeef' }),
  }

  const mockUser: User = {
    id: 'uuid',
    email: 'a@b.com',
    password: 'hash',
    publicKey: '0x123',
    substratePublicKey: null,
    createdAt: new Date(),
    googleId: null,
    displayName: null,
  }

  beforeEach(async () => {
    vaultService = {
      storeSecret: jest.fn().mockResolvedValue({}),
      getSecret: jest.fn().mockResolvedValue({ privateKey: '0xprivateKey' }),
      generateKeyPair: jest.fn(),
    } as any

    userRepository = {
      create: jest.fn().mockReturnValue(mockUser),
      save: jest.fn().mockResolvedValue(mockUser),
      findOne: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: VaultService, useValue: vaultService },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: 'WalletService', useValue: walletMock },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('registerUser', () => {
    const dto: CreateUserDto = { email: 'test@example.com', password: 'password123' }

    it('registers a new user successfully', async () => {
      userRepository.findOne.mockResolvedValue(null)
      const result = await service.registerUser(dto)

      expect(argon2.hash).toHaveBeenCalledWith(dto.password)
      expect(walletMock.generateWallet).toHaveBeenCalledWith(dto.email)
      expect(userRepository.create).toHaveBeenCalledWith({
        email: dto.email,
        password: 'hashedPassword',
        publicKey: '0xabc',
      })
      expect(userRepository.save).toHaveBeenCalledWith(mockUser)
      expect(vaultService.storeSecret).toHaveBeenCalledWith(`ethereum/${mockUser.id}`, {
        privateKey: '0xprivateKey',
      })
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        publicKey: '0xabc',
      })
    })

    it('throws ConflictException if user exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser)
      await expect(service.registerUser(dto)).rejects.toThrow(ConflictException)
    })

    it('throws InternalServerErrorException on vault error', async () => {
      userRepository.findOne.mockResolvedValue(null)
      vaultService.storeSecret.mockRejectedValue(new Error('vault down'))
      await expect(service.registerUser(dto)).rejects.toThrow(InternalServerErrorException)
    })
  })

  describe('findOrCreateFromGoogle', () => {
    const googleData = { googleId: 'gid', email: 'test@example.com', displayName: 'Test User' }

    it('creates new user on first login', async () => {
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      const newUser = {
        ...mockUser,
        email: googleData.email,
        googleId: googleData.googleId,
        displayName: googleData.displayName,
      } as User
      userRepository.create.mockReturnValueOnce(newUser)
      userRepository.save.mockResolvedValueOnce(newUser)

      const result = await service.findOrCreateFromGoogle(googleData)
      expect(userRepository.create).toHaveBeenCalledWith({
        email: googleData.email,
        displayName: googleData.displayName,
        googleId: googleData.googleId,
        publicKey: '0xpublicAddress',
      })
      expect(userRepository.save).toHaveBeenCalledWith(newUser)
      expect(vaultService.storeSecret).toHaveBeenCalledWith(`ethereum/${newUser.id}`, {
        privateKey: '0xprivateKey',
      })
      expect(result.email).toBe(googleData.email)
      expect(result.googleId).toBe(googleData.googleId)
    })

    it('links existing user without googleId', async () => {
      const existing = { ...mockUser, googleId: null, displayName: null } as User
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)

      const result = await service.findOrCreateFromGoogle(googleData)
      expect(result.googleId).toBe(googleData.googleId)
      expect(userRepository.save).toHaveBeenCalledWith({
        ...existing,
        googleId: googleData.googleId,
        displayName: googleData.displayName,
      })
    })

    it('throws BadRequestException on incomplete data', async () => {
      await expect(
        service.findOrCreateFromGoogle({ googleId: '', email: '', displayName: '' })
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('sendTokensFromUser', () => {
    const mockEthService = { sendNative: jest.fn().mockResolvedValue({ hash: '0xhash' }) }
    beforeEach(() => service.setEthereumService(mockEthService as any))

    it('throws if EthereumService not set', async () => {
      const fresh = Object.assign(Object.create(UsersService.prototype), {
        userRepository,
        vaultService,
        logger: service['logger'],
        ethereumService: null,
      }) as UsersService
      await expect(fresh.sendTokensFromUser('a@b.com', '0x123', '1')).rejects.toThrow(
        InternalServerErrorException
      )
    })

    it('throws if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null)
      await expect(service.sendTokensFromUser('no@user.com', '0x123', '1')).rejects.toThrow(
        BadRequestException
      )
    })

    it('sends transaction successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser)
      const res = await service.sendTokensFromUser('test@example.com', '0xabc', '0.5')
      expect(mockEthService.sendNative).toHaveBeenCalledWith(
        'test@example.com',
        '0xabc',
        '0.5',
        false
      )
      expect(res).toEqual({ hash: '0xhash' })
    })
  })

  describe('findByEmail & findById', () => {
    it('findByEmail returns user or null', async () => {
      userRepository.findOne.mockResolvedValue(mockUser)
      expect(await service.findByEmail('test@example.com')).toEqual(mockUser)
      userRepository.findOne.mockResolvedValue(null)
      expect(await service.findByEmail('missing@example.com')).toBeNull()
    })

    it('findById returns user or null', async () => {
      userRepository.findOne.mockResolvedValue(mockUser)
      expect(await service.findById('123')).toEqual(mockUser)
      userRepository.findOne.mockResolvedValue(null)
      expect(await service.findById('999')).toBeNull()
    })
  })

  describe('validateUser', () => {
    it('validates correct credentials', async () => {
      userRepository.findOne.mockResolvedValue(mockUser)
      ;(argon2.verify as jest.Mock).mockResolvedValue(true)
      expect(await service.validateUser('test@example.com', 'password')).toEqual(mockUser)
    })

    it('rejects incorrect credentials or missing user', async () => {
      userRepository.findOne.mockResolvedValue(mockUser)
      ;(argon2.verify as jest.Mock).mockResolvedValue(false)
      expect(await service.validateUser('test@example.com', 'wrong')).toBeUndefined()
      userRepository.findOne.mockResolvedValue(null)
      expect(await service.validateUser('no@example.com', 'pass')).toBeUndefined()
    })
  })

  describe('convertToSubstrateAddress & getSubstrateAddress', () => {
    it('converts valid Ethereum public key to Substrate address', async () => {
      const validKey = '0x' + 'a'.repeat(64)
      const sub = await service.convertToSubstrateAddress(validKey)
      expect(typeof sub).toBe('string')
      expect(sub.startsWith('5')).toBe(true)
    })

    it('throws BadRequestException for invalid address', async () => {
      await expect(service.convertToSubstrateAddress('1234')).rejects.toThrow(BadRequestException)
    })

    it('getSubstrateAddress returns converted for existing user', async () => {
      const validKey = '0x' + 'b'.repeat(64)
      userRepository.findOne.mockResolvedValueOnce({ ...mockUser, publicKey: validKey } as User)
      const sub = await service.getSubstrateAddress('test@example.com')
      expect(sub.startsWith('5')).toBe(true)
    })

    it('throws BadRequestException when user not found', async () => {
      userRepository.findOne.mockResolvedValueOnce(null)
      await expect(service.getSubstrateAddress('no@example.com')).rejects.toThrow(
        BadRequestException
      )
    })
  })

  it('should call generateWallet with email', async () => {
    const dto = { email: 'test@example.com', password: 'password123' }
    await service.registerUser(dto)
    expect(walletMock.generateWallet).toHaveBeenCalledWith(dto.email)
  })
})
