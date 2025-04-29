import { Test, TestingModule } from '@nestjs/testing'
import { UsersController } from './users.controller'
import { UsersService } from '../services/users.service'
import { AuthService } from '../services/auth.service'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { LoginUserDto } from '../dto/login-user.dto'
import { CreateUserDto } from '../dto/create-user.dto'

describe('UsersController', () => {
  let usersController: UsersController
  let usersService: Partial<UsersService>
  let authService: Partial<AuthService>
  let jwtService: Partial<JwtService>
  let configService: Partial<ConfigService>
  let mockResponse: Partial<Response>

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    publicKey: '0x123',
  }

  beforeEach(async () => {
    usersService = {
      registerUser: jest.fn().mockResolvedValue(mockUser),
    }
    authService = {
      validateUser: jest.fn().mockResolvedValue(mockUser as any),
    }
    jwtService = {
      sign: jest.fn().mockReturnValue('token'),
    }
    configService = {
      get: jest.fn().mockReturnValue('development'),
    }
    mockResponse = {
      cookie: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: AuthService, useValue: authService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile()

    usersController = module.get<UsersController>(UsersController)
  })

  it('should be defined', () => {
    expect(usersController).toBeDefined()
  })

  describe('register', () => {
    it('should register a new user', async () => {
      const createDto: CreateUserDto = { email: mockUser.email, password: 'pass' }
      const result = await usersController.register(createDto, mockResponse as Response)

      expect(usersService.registerUser).toHaveBeenCalledWith(createDto)
      expect(jwtService.sign).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        publicKey: mockUser.publicKey,
      })
      expect(mockResponse.cookie).toHaveBeenCalledWith('authToken', 'token', expect.any(Object))
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        publicKey: mockUser.publicKey,
      })
    })
  })

  describe('login', () => {
    it('should login a user with valid credentials', async () => {
      const loginDto: LoginUserDto = { email: mockUser.email, password: 'pass' }
      const result = await usersController.login(loginDto, mockResponse as Response)

      expect(authService.validateUser).toHaveBeenCalledWith(mockUser.email, 'pass')
      expect(jwtService.sign).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        displayName: undefined,
        publicKey: mockUser.publicKey,
      })
      expect(mockResponse.cookie).toHaveBeenCalled()
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        displayName: undefined,
      })
    })

    it('should throw UnauthorizedException for invalid credentials', async () => {
      ;(authService.validateUser as jest.Mock).mockResolvedValue(undefined)
      const loginDto: LoginUserDto = { email: 'bad', password: 'bad' }
      await expect(usersController.login(loginDto, mockResponse as Response)).rejects.toThrow()
    })
  })
})
