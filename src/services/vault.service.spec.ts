import { Test, TestingModule } from '@nestjs/testing'
import { VaultService } from './vault.service'
import { ethers } from 'ethers'

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
      expect(result).toEqual({ success: true })
    })
  })

  describe('getSecret', () => {
    it('should return null when secret does not exist', async () => {
      const result = await service.getSecret('nonexistent/path')
      expect(result).toEqual(null)
    })

    it('should retrieve a stored secret successfully', async () => {
      const testSecret = { privateKey: 'test-private-key' }
      await service.storeSecret('test/path', testSecret)

      const result = await service.getSecret('test/path')
      expect(result).toEqual(testSecret)
    })
  })
})
