import { Test, type TestingModule } from '@nestjs/testing'
import { VaultService } from './vault.service'
import { ethers } from 'ethers'

// Мокаем node-vault
jest.mock('node-vault', () => {
  return () => ({
    write: jest.fn().mockResolvedValue({}),
    read: jest.fn().mockResolvedValue({ data: { privateKey: 'mock-private-key' } }),
  })
})

jest.mock('ethers')

describe('VaultService', () => {
  let service: VaultService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VaultService],
    }).compile()

    service = module.get<VaultService>(VaultService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('generateKeyPair', () => {
    it('should generate a valid key pair', async () => {
      const mockWallet = {
        address: '0x123',
        privateKey: '0xabc',
      }

      // Mock ethers.Wallet.createRandom()
      ;(ethers.Wallet.createRandom as jest.Mock).mockReturnValue(mockWallet)

      const keyPair = await service.generateKeyPair()

      expect(keyPair).toEqual({
        publicKey: mockWallet.address,
        privateKey: mockWallet.privateKey,
      })
      expect(ethers.Wallet.createRandom).toHaveBeenCalled()
    })
  })

  describe('storeSecret', () => {
    it('should store a secret successfully', async () => {
      const result = await service.storeSecret('test/path', { privateKey: 'secret-key' })
      expect(result).toBeDefined()
    })
  })

  describe('getSecret', () => {
    it('should retrieve a secret successfully', async () => {
      const result = await service.getSecret('test/path')
      expect(result).toEqual({ privateKey: 'mock-private-key' })
    })
  })
})
