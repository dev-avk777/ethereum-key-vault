/**
 * @fileoverview E2E tests for the Auth module:
 *   - JWT token generation and validation
 *   - /auth/user-info endpoint behavior under various scenarios
 */

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { User } from '../src/entities/user.entity'
import { UsersService } from '../src/services/users.service'

describe('Auth (e2e)', () => {
  let app: INestApplication
  let jwtService: JwtService

  // Mock user returned by UsersService
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    googleId: 'google123',
    displayName: 'Test User',
    publicKey: '0x123abc',
  }

  /**
   * Initialize Nest application with overridden
   * User repository and UsersService.
   */
  beforeAll(async () => {
    const userRepositoryMock = {
      findOne: jest.fn().mockResolvedValue(mockUser),
    }
    const usersServiceMock = {
      findById: jest.fn().mockResolvedValue(mockUser),
      findOrCreateFromGoogle: jest.fn().mockResolvedValue(mockUser),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(userRepositoryMock)
      .overrideProvider(UsersService)
      .useValue(usersServiceMock)
      .compile()

    app = moduleFixture.createNestApplication()
    // Apply validation pipe as in production
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    jwtService = moduleFixture.get<JwtService>(JwtService)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  /**
   * Ensure JwtService produces and verifies tokens correctly.
   */
  describe('JWT Generation', () => {
    it('should generate valid JWT token', () => {
      const userData = {
        id: '123',
        email: 'test@example.com',
        googleId: 'google123',
        displayName: 'Test User',
      }
      const token = jwtService.sign(userData)
      const decoded = jwtService.verify(token)
      expect(decoded).toMatchObject(userData)
    })
  })

  /**
   * Tests for GET /auth/user-info:
   * - missing token
   * - malformed token
   * - valid token but user not found
   * - valid token and user exists
   */
  describe('/auth/user-info (GET)', () => {
    it('should return 401 for missing token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/user-info').expect(401)
      expect(res.body).toHaveProperty('statusCode', 401)
      expect(res.body).toHaveProperty('message', 'Unauthorized')
    })

    it('should return 401 for invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/user-info')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401)
      expect(res.body).toHaveProperty('statusCode', 401)
      expect(res.body).toHaveProperty('message')
    })

    it('should return user info for valid token', async () => {
      const userData = {
        id: '123',
        email: 'test@example.com',
        googleId: 'google123',
        displayName: 'Test User',
      }
      // Override findById to return full user object
      jest.spyOn(app.get(UsersService), 'findById').mockResolvedValue({
        ...mockUser,
        createdAt: new Date(),
        password: null,
      })

      const token = jwtService.sign(userData)
      const res = await request(app.getHttpServer())
        .get('/auth/user-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        publicKey: mockUser.publicKey,
      })
    })

    it('should return 500 when user not found', async () => {
      jest.spyOn(app.get(UsersService), 'findById').mockResolvedValue(null)

      const token = jwtService.sign({
        id: '123',
        email: 'test@example.com',
        googleId: 'google123',
        displayName: 'Test User',
      })
      const res = await request(app.getHttpServer())
        .get('/auth/user-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(500)

      expect(res.body).toHaveProperty('statusCode', 500)
      expect(res.body).toHaveProperty('message')
    })
  })
})
