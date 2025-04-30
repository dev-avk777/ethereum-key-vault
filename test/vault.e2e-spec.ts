import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import * as cookieParser from 'cookie-parser'
import { VaultService } from '../src/services/vault.service'
import { Wallet } from 'ethers'

/**
 * E2E integration test for Vault interaction:
 * 1) Registers a new user, which stores the private key in Vault
 * 1.5) Directly verifies that the private key is stored in Vault
 * 2) Uses the returned auth cookie to call GET /ethereum/keys
 * 3) Verifies that the publicKey in the response matches the one returned at registration
 */
describe('Vault Integration (e2e)', () => {
  let app: INestApplication
  let server: any
  let vaultService: VaultService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    await app.init()
    server = app.getHttpServer()
    vaultService = app.get<VaultService>(VaultService)
  })

  afterAll(async () => {
    await app.close()
  })

  it('stores secret in Vault on registration and exposes publicKey via /ethereum/keys', async () => {
    const email = `vault-test-${Date.now()}@example.com`
    const password = 'password123'

    // 1) Register the user (stores private key in Vault)
    const registerRes = await request(server)
      .post('/users/register')
      .send({ email, password })
      .expect(201)

    expect(registerRes.body).toHaveProperty('id')
    expect(registerRes.body).toHaveProperty('email', email)
    expect(registerRes.body).toHaveProperty('publicKey')
    const publicKey = registerRes.body.publicKey

    // Extract auth cookie for subsequent request
    const cookie = registerRes.headers['set-cookie']
    expect(cookie).toBeDefined()

    /**
     * 1.5) Direct Vault Check:
     *    → vaultService.getSecret retrieves stored privateKey
     *    → ensure privateKey exists and is a string
     *    → instantiate Wallet and verify its signingKey.publicKey matches the returned one
     */

    // Получаем userId из тела ответа
    const userId = registerRes.body.id
    expect(userId).toBeDefined()

    const secret = await vaultService.getSecret(`ethereum/${userId}`)
    expect(secret).toHaveProperty('privateKey')
    expect(typeof secret.privateKey).toBe('string')

    const vaultWallet = new Wallet(secret.privateKey)
    expect(vaultWallet.address).toBe(publicKey)

    // 2) Retrieve Ethereum keys (reads from Vault)
    const keysRes = await request(server).get('/ethereum/keys').set('Cookie', cookie).expect(200)

    expect(Array.isArray(keysRes.body)).toBe(true)
    expect(keysRes.body.length).toBeGreaterThan(0)
    const keyEntry = keysRes.body.find((k: any) => k.publicKey === publicKey)
    expect(keyEntry).toBeDefined()
    expect(keyEntry).toHaveProperty('publicKey', publicKey)
  })
})
