import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { CreateUserDto } from '../src/dto/create-user.dto'
import { LoginUserDto } from '../src/dto/login-user.dto'
import { User } from '../src/entities/user.entity'
import { VaultService } from '../src/services/vault.service'

/**
 * @fileoverview E2E tests for the Users module:
 *   - POST /users/register: registration flow and DTO validations
 *   - POST /users/login: invalid credentials handling
 */
describe('Users (e2e)', () => {
  let app: INestApplication
  // In-memory store simulating the User table
  const users: Partial<User>[] = []

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue({
        findOne: jest.fn(({ where: { email } }) =>
          Promise.resolve((users.find(u => u.email === email) as User) || null)
        ),
        create: jest.fn(dto => ({ ...dto })),
        save: jest.fn((user: any) => {
          user.id = `uuid-${users.length + 1}`
          users.push(user)
          return Promise.resolve(user)
        }),
      })

      .overrideProvider(VaultService)
      .useValue({
        storeSecret: jest.fn().mockResolvedValue(undefined),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    // Enable DTO validation
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    // Reset in-memory users between tests
    users.length = 0
  })

  /**
   * Test suite for the registration endpoint
   */
  describe('/users/register (POST)', () => {
    const validDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'password123',
    }

    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/register')
        .send(validDto)
        .expect(201)

      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('email', validDto.email)
      expect(res.body).toHaveProperty('publicKey')
    })

    it('should fail with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/users/register')
        .send({ ...validDto, email: 'invalid-email' })
        .expect(400)
    })

    it('should fail with short password', async () => {
      await request(app.getHttpServer())
        .post('/users/register')
        .send({ ...validDto, password: '12345' })
        .expect(400)
    })
  })

  /**
   * Test suite for the login endpoint
   */
  describe('/users/login (POST)', () => {
    const loginDto: LoginUserDto = {
      email: 'test@example.com',
      password: 'password123',
    }

    it('should fail with invalid credentials', async () => {
      // No users exist, so login should be unauthorized
      await request(app.getHttpServer()).post('/users/login').send(loginDto).expect(401)
    })
  })
})
