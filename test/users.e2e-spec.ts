import { Test, type TestingModule } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { type CreateUserDto } from '../src/dto/create-user.dto'

describe('Users (e2e)', () => {
  let app: INestApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('/users/register (POST)', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'password123',
    }

    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/users/register')
        .send(createUserDto)
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id')
          expect(res.body).toHaveProperty('email', createUserDto.email)
          expect(res.body).toHaveProperty('publicKey')
        })
    })

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/users/register')
        .send({ ...createUserDto, email: 'invalid-email' })
        .expect(400)
    })

    it('should fail with short password', () => {
      return request(app.getHttpServer())
        .post('/users/register')
        .send({ ...createUserDto, password: '12345' })
        .expect(400)
    })
  })

  describe('/users/login (POST)', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    }

    it('should fail with invalid credentials', () => {
      return request(app.getHttpServer()).post('/users/login').send(loginDto).expect(401)
    })
  })
})
