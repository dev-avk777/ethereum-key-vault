import { Test, TestingModule } from '@nestjs/testing'
import { ethers } from 'ethers'
import * as vault from 'node-vault'
import { VaultService, VaultServiceProvider, MemoryVaultService } from './vault.service'

jest.mock('ethers')
jest.mock('node-vault')

describe('VaultService', () => {
  let service: VaultService
  let vaultClient: jest.Mocked<vault.client>

  beforeEach(async () => {
    vaultClient = {
      write: jest.fn(),
      read: jest.fn(),
    } as any
    ;(vault as any).mockReturnValue(vaultClient)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        {
          provide: 'VAULT_CONFIG',
          useValue: { endpoint: 'http://localhost:8200', token: 'test-token' },
        },
        VaultServiceProvider,
      ],
    }).compile()

    service = module.get<VaultService>(VaultService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('generateKeyPair', () => {
    it('should generate a valid key pair', async () => {
      const mockWallet = { address: '0x123', privateKey: '0xabc' }
      ;(ethers.Wallet.createRandom as jest.Mock).mockReturnValue(mockWallet)

      const keyPair = await service.generateKeyPair()
      expect(keyPair).toEqual({ publicKey: mockWallet.address, privateKey: mockWallet.privateKey })
      expect(ethers.Wallet.createRandom).toHaveBeenCalled()
    })
  })

  describe('MemoryVaultService', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'development'
      const module: TestingModule = await Test.createTestingModule({
        providers: [VaultService, { provide: 'VaultServiceImpl', useClass: MemoryVaultService }],
      }).compile()
      service = module.get<VaultService>(VaultService)
    })

    it('should store and retrieve secret', async () => {
      const secret = { privateKey: 'test-private-key' }
      await service.storeSecret('test/path', secret)
      const result = await service.getSecret('test/path')
      expect(result).toEqual(secret)
    })

    it('should return null for nonexistent secret', async () => {
      const result = await service.getSecret('nonexistent/path')
      expect(result).toBeNull()
    })
  })

  describe('RealVaultService', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'production'
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VaultService,
          {
            provide: 'VAULT_CONFIG',
            useValue: { endpoint: 'http://localhost:8200', token: 'test-token' },
          },
          VaultServiceProvider,
        ],
      }).compile()
      service = module.get<VaultService>(VaultService)
    })

    it('should store secret in Vault (KV v2)', async () => {
      const secret = { privateKey: 'test-private-key' }
      vaultClient.write.mockResolvedValue({})

      await service.storeSecret('ethereum/test@example.com', secret)
      expect(vaultClient.write).toHaveBeenCalledWith('secret/data/ethereum/test@example.com', {
        data: secret,
      })
    })

    it('should retrieve secret from Vault (KV v2)', async () => {
      const secret = { privateKey: 'test-private-key' }
      vaultClient.read.mockResolvedValue({ data: { data: secret } })

      const result = await service.getSecret('ethereum/test@example.com')
      expect(result).toEqual(secret)
      expect(vaultClient.read).toHaveBeenCalledWith('secret/data/ethereum/test@example.com')
    })

    it('should return null if secret not found', async () => {
      vaultClient.read.mockRejectedValue(new Error('Key not found'))
      const result = await service.getSecret('nonexistent/path')
      expect(result).toBeNull()
    })

    it('should throw error on Vault failure', async () => {
      vaultClient.write.mockRejectedValue(new Error('Vault unavailable'))
      await expect(service.storeSecret('test/path', { key: 'value' })).rejects.toThrow(
        'Failed to store secret'
      )
    })
  })
})
