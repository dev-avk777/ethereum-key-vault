/**
 * Integration tests for RealVaultService with a live Vault KV v2 backend.
 *
 * Prerequisites:
 * - Vault server running and accessible at VAULT_ENDPOINT (default http://127.0.0.1:8200)
 * - KV engine mounted at 'secret/' with version=2 enabled
 * - VAULT_TOKEN (root token or token with create/read capabilities) set in env
 */
import { RealVaultService } from './vault.service'
import { VaultOptions } from 'node-vault'

describe('RealVaultService (integration)', () => {
  let service: RealVaultService
  const endpoint = process.env.VAULT_ENDPOINT || 'http://127.0.0.1:8200'
  const token = process.env.VAULT_TOKEN || 'dev-only-token'
  // Use a unique path for each test run to avoid collisions
  // Simulating a UUID instead of an email
  const testPath = `ethereum/test-integration-${Date.now()}`

  beforeAll(() => {
    // Initialize service connecting to the live Vault
    const options: VaultOptions = { endpoint, token }
    service = new RealVaultService(options)
  })

  it('should store and retrieve a secret in KV v2', async () => {
    // Write a test secret
    const payload = { foo: 'bar', timestamp: Date.now() }
    await service.storeSecret(testPath, payload)

    // Read it back
    const data = await service.getSecret(testPath)
    expect(data).toEqual(payload)
  })

  it('should version secrets on repeated writes', async () => {
    const first = { version: 1, value: 'a' }
    const second = { version: 2, value: 'b' }

    // First write
    await service.storeSecret(testPath, first)
    let data = await service.getSecret(testPath)
    expect(data).toEqual(first)

    // Second write
    await service.storeSecret(testPath, second)
    data = await service.getSecret(testPath)
    expect(data).toEqual(second)
  })
})
