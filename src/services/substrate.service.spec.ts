import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { encodeAddress, mnemonicGenerate } from '@polkadot/util-crypto'
import { SubstrateService } from './substrate.service'
import { VaultService } from './vault.service'

//
// Jest mocks for all Polkadot dependencies
//
jest.mock('@polkadot/api', () => ({
  ApiPromise: { create: jest.fn() },
  WsProvider: jest.fn(),
}))

jest.mock('@polkadot/keyring', () => ({
  // We don't reference Keyring directly in tests, but SubstrateService will call it under the hood
  Keyring: jest.fn().mockImplementation(() => ({
    addFromUri: jest.fn().mockReturnValue({ publicKey: Uint8Array.from([1, 2, 3, 4]) }),
  })),
}))

jest.mock('@polkadot/util-crypto', () => ({
  mnemonicGenerate: jest.fn().mockReturnValue('mock seed phrase'),
  encodeAddress: jest.fn().mockReturnValue('5MockSS58Address'),
}))

describe('SubstrateService', () => {
  let service: SubstrateService
  let vaultService: jest.Mocked<VaultService>
  const dummyApi: any = {
    tx: { balances: { transfer: jest.fn() } },
  }

  beforeEach(async () => {
    // Prepare a mock VaultService
    vaultService = {
      storeSecret: jest.fn(),
      getSecret: jest.fn(),
    } as any

    // Configure the testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubstrateService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'SUBSTRATE_SS58_PREFIX') {
                return 42
              }
              return 'wss://mock-node'
            }),
          },
        },
        { provide: VaultService, useValue: vaultService },
      ],
    }).compile()

    service = module.get(SubstrateService)

    // Mock ApiPromise.create to return our dummyApi
    ;(ApiPromise.create as jest.Mock).mockResolvedValue(dummyApi)
    // Simulate onModuleInit to set service.api
    await service.onModuleInit()
    expect(ApiPromise.create).toHaveBeenCalledWith({
      provider: expect.any(WsProvider),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('generateWallet: should create mnemonic, store it, and return SS58 address', async () => {
    const result = await service.generateWallet('user-123')
    // mnemonicGenerate was called
    expect(mnemonicGenerate).toHaveBeenCalled()
    // VaultService.storeSecret was called with correct path and payload
    expect(vaultService.storeSecret).toHaveBeenCalledWith('substrate/user-123', {
      mnemonic: 'mock seed phrase',
    })
    // SS58 address is returned
    expect(result.address).toBe('5MockSS58Address')
    expect(result.privateKey).toBe('mock seed phrase')
    // encodeAddress was called with the publicKey and default prefix (42)
    expect(encodeAddress).toHaveBeenCalledWith(Uint8Array.from([1, 2, 3, 4]), 42)
  })

  it('sendTokens: should throw if no mnemonic in Vault', async () => {
    vaultService.getSecret.mockResolvedValue(null)
    await expect(service.sendTokens('user-123', '5DestAddr', '1000000000000')).rejects.toThrow(
      BadRequestException
    )
  })

  it('sendTokens: should reject on dispatchError from chain', async () => {
    // Return a fake mnemonic
    vaultService.getSecret.mockResolvedValue({ mnemonic: 'mock seed phrase' })

    // Create a fake extrinsic that will invoke dispatchError
    const fakeExtrinsic: any = {
      signAndSend: (_pair: any, callback: any) => {
        callback({
          status: { isInBlock: false },
          dispatchError: { toString: () => 'Bad origin' },
          txHash: { toHex: () => '0xDeadBeef' },
        })
        return Promise.resolve()
      },
    }
    dummyApi.tx.balances.transfer.mockReturnValue(fakeExtrinsic)

    await expect(service.sendTokens('user-123', '5DestAddr', '123')).rejects.toThrow(/Bad origin/)
  })

  it('sendTokens: should resolve hash when included in block', async () => {
    vaultService.getSecret.mockResolvedValue({ mnemonic: 'mock seed phrase' })

    const fakeHash = '0xFeedFace'
    const fakeExtrinsic: any = {
      signAndSend: (_pair: any, callback: any) => {
        // first call: in block
        callback({
          status: {
            isInBlock: true,
            asInBlock: '0xBlockHash',
          },
          dispatchError: null,
          txHash: { toHex: () => fakeHash },
        })
        return Promise.resolve()
      },
    }
    dummyApi.tx.balances.transfer.mockReturnValue(fakeExtrinsic)

    const { hash } = await service.sendTokens('user-123', '5DestAddr', '500')
    expect(hash).toBe(fakeHash)
  })
})
