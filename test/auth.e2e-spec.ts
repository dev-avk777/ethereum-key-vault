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

    // Мокируем метод validate в GoogleStrategy
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
          done(null, mockUser) // Вызываем done с пользователем
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
        .expect(302) // Проверяем редирект
        .expect(res => {
          // Проверяем, что редирект содержит google.com
          expect(res.headers.location).toContain('accounts.google.com')
        })
    })
  })

  describe('/auth/google/callback (GET)', () => {
    it('should redirect to frontend with token', async () => {
      // Мокируем JwtService.sign, чтобы вернуть фиксированный токен
      const mockToken = 'mock-jwt-token'
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken)

      // Делаем запрос к callback endpoint
      const response = await request(app.getHttpServer()).get('/auth/google/callback').expect(302) // Проверяем редирект

      // Проверяем, что ответ содержит редирект на frontend с токеном
      expect(response.headers.location).toContain('authToken=' + mockToken)
    })

    it('should handle errors during oauth callback', async () => {
      // Мокируем ошибку в GoogleStrategy
      jest
        .spyOn(GoogleStrategy.prototype, 'validate')
        .mockImplementation(
          async (accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) => {
            done(new Error('Authentication failed'), false)
          }
        )

      // Делаем запрос к callback endpoint
      const response = await request(app.getHttpServer()).get('/auth/google/callback').expect(302) // Проверяем редирект

      // Проверяем, что ответ содержит редирект на страницу ошибки
      expect(response.headers.location).toContain('auth-error')
    })
  })

  describe('JWT Generation', () => {
    it('should generate valid JWT token', () => {
      // Создаем тестовые данные пользователя
      const userData = {
        id: '123',
        email: 'test@example.com',
        googleId: 'google123',
        displayName: 'Test User',
      }

      // Генерируем токен с тестовыми данными
      const token = jwtService.sign(userData)

      // Проверяем, что токен можно верифицировать
      const decoded = jwtService.verify(token)

      // Проверяем, что данные сохранились корректно
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
      // Создаем тестовые данные пользователя
      const userData = {
        id: '123',
        email: 'test@example.com',
        googleId: 'google123',
        displayName: 'Test User',
      }

      // Генерируем токен для авторизации
      const token = jwtService.sign(userData)

      // Делаем запрос с авторизационным токеном
      return request(app.getHttpServer())
        .get('/auth/user-info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(res => {
          // Проверяем, что ответ содержит данные пользователя
          expect(res.body.id).toBe(userData.id)
          expect(res.body.email).toBe(userData.email)
        })
    })
  })
})
