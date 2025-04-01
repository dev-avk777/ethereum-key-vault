import { Test, type TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { UsersService } from './users.service'
import * as argon2 from 'argon2'

jest.mock('argon2', () => ({
  verify: jest.fn(),
}))

describe('AuthService', () => {
  let service: AuthService
  let usersService: jest.Mocked<UsersService>

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedPassword',
    publicKey: '0x123',
    createdAt: new Date(),
  }

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      validateUser: jest.fn(),
    } as unknown as jest.Mocked<UsersService>

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      const email = 'test@example.com'
      const password = 'password123'

      usersService.findByEmail.mockResolvedValue(mockUser)
      ;(argon2.verify as jest.Mock).mockResolvedValue(true)

      const result = await service.validateUser(email, password)
      expect(result).toEqual(mockUser)
    })

    it('should return undefined if user not found', async () => {
      const email = 'nonexistent@example.com'
      const password = 'password123'

      usersService.findByEmail.mockResolvedValue(null)

      const result = await service.validateUser(email, password)
      expect(result).toBeUndefined()
    })

    it('should return undefined if password is invalid', async () => {
      const email = 'test@example.com'
      const password = 'wrongpassword'

      usersService.findByEmail.mockResolvedValue(mockUser)
      ;(argon2.verify as jest.Mock).mockResolvedValue(false)

      const result = await service.validateUser(email, password)
      expect(result).toBeUndefined()
    })
  })
})
