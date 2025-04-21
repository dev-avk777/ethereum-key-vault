import { Test, TestingModule } from '@nestjs/testing'
import { UsersController } from './users.controller'
import { UsersService } from '../services/users.service'
import { AuthService } from '../services/auth.service'
import { CreateUserDto } from '../dto/create-user.dto'
import { LoginUserDto } from '../dto/login-user.dto'
import { UnauthorizedException } from '@nestjs/common'
import { Response } from 'express'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

describe('UsersController', () => {
  let controller: UsersController
  let usersService: jest.Mocked<UsersService>
  let authService: jest.Mocked<AuthService>
  let jwtService: jest.Mocked<JwtService>
  let configService: jest.Mocked<ConfigService>

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedPassword',
    publicKey: '0x123',
    createdAt: new Date(),
    googleId: null,
    displayName: null,
  }

  beforeEach(async () => {
    usersService = {
      registerUser: jest.fn(),
      findByEmail: jest.fn(),
    } as unknown as jest.Mocked<UsersService>

    authService = {
      validateUser: jest.fn(),
    } as unknown as jest.Mocked<AuthService>

    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    } as unknown as jest.Mocked<JwtService>

    configService = {
      get: jest.fn().mockImplementation(key => {
        if (key === 'NODE_ENV') {
          return 'test'
        }
        return 'test-value'
      }),
    } as unknown as jest.Mocked<ConfigService>

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile()

    controller = module.get<UsersController>(UsersController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('register', () => {
    it('should register a new user', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      usersService.registerUser.mockResolvedValue(mockUser)

      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response

      const result = await controller.register(createUserDto, mockResponse)

      expect(usersService.registerUser).toHaveBeenCalledWith(createUserDto)
      expect(jwtService.sign).toHaveBeenCalled()
      expect(mockResponse.cookie).toHaveBeenCalled()
      expect(result).toEqual({ id: mockUser.id, email: mockUser.email })
    })
  })

  describe('login', () => {
    it('should login a user with valid credentials', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      authService.validateUser.mockResolvedValue(mockUser)

      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response

      const result = await controller.login(loginDto, mockResponse)

      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password)
      expect(jwtService.sign).toHaveBeenCalled()
      expect(mockResponse.cookie).toHaveBeenCalled()
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        displayName: mockUser.displayName,
      })
    })

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      }

      authService.validateUser.mockResolvedValue(undefined)

      const mockResponse = {} as Response
      await expect(controller.login(loginDto, mockResponse)).rejects.toThrow(UnauthorizedException)
    })
  })
})
