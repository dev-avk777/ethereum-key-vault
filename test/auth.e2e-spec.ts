import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { JwtService } from '@nestjs/jwt'
import { GoogleStrategy } from '../src/auth/google.strategy'
import { VerifyCallback } from 'passport-google-oauth20'

describe('Auth (e2e)', () => {
  let app: INestApplication
  let jwtService: JwtService

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    jwtService = moduleFixture.get<JwtService>(JwtService)

    // Mock the validate method in GoogleStrategy
    jest
      .spyOn(GoogleStrategy.prototype, 'validate')
      .mockImplementation(
        async (accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) => {
          const mockUser = {
            id: '123',
            email: 'test@example.com',
            googleId: 'google123',
            displayName: 'Test User',
            publicKey: '0x123abc',
          }
          done(null, mockUser) // Call done with the user
        }
      )

    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('/auth/google (GET)', () => {
    it('should redirect to Google OAuth', () => {
      return request(app.getHttpServer())
        .get('/auth/google')
        .expect(302) // Check for redirect
        .expect(res => {
          // Check that the redirect contains google.com
          expect(res.headers.location).toContain('accounts.google.com')
        })
    })
  })

  describe('/auth/google/callback (GET)', () => {
    it('should redirect to frontend with token', async () => {
      // Mock JwtService.sign to return a fixed token
      const mockToken = 'mock-jwt-token'
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken)

      // Make a request to the callback endpoint
      const response = await request(app.getHttpServer()).get('/auth/google/callback').expect(302) // Check for redirect

      // Check that the response contains a redirect to frontend with token
      expect(response.headers.location).toContain('authToken=' + mockToken)
    })

    it('should handle errors during oauth callback', async () => {
      // Mock an error in GoogleStrategy
      jest
        .spyOn(GoogleStrategy.prototype, 'validate')
        .mockImplementation(
          async (accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) => {
            done(new Error('Authentication failed'), false)
          }
        )

      // Make a request to the callback endpoint
      const response = await request(app.getHttpServer()).get('/auth/google/callback').expect(302) // Check for redirect

      // Check that the response contains a redirect to the error page
      expect(response.headers.location).toContain('auth-error')
    })
  })

  describe('JWT Generation', () => {
    it('should generate valid JWT token', () => {
      // Create test user data
      const userData = {
        id: '123',
        email: 'test@example.com',
        googleId: 'google123',
        displayName: 'Test User',
      }

      // Generate token with test data
      const token = jwtService.sign(userData)

      // Check that the token can be verified
      const decoded = jwtService.verify(token)

      // Check that the data was saved correctly
      expect(decoded.id).toBe(userData.id)
      expect(decoded.email).toBe(userData.email)
      expect(decoded.googleId).toBe(userData.googleId)
      expect(decoded.displayName).toBe(userData.displayName)
    })
  })

  describe('/auth/user-info (GET)', () => {
    it('should return 401 for unauthorized requests', async () => {
      return request(app.getHttpServer()).get('/auth/user-info').expect(401)
    })

    it('should return user info for authorized requests', async () => {
      // Create test user data
      const userData = {
        id: '123',
        email: 'test@example.com',
        googleId: 'google123',
        displayName: 'Test User',
      }

      // Generate token for authorization
      const token = jwtService.sign(userData)

      // Make request with authorization token
      return request(app.getHttpServer())
        .get('/auth/user-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(res => {
          // Check that the response contains user data
          expect(res.body.id).toBe(userData.id)
          expect(res.body.email).toBe(userData.email)
        })
    })
  })
})
