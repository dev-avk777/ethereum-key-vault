import { Test, TestingModule } from '@nestjs/testing'
import { UsersController } from './users.controller'
import { UsersService } from '../services/users.service'
import { AuthService } from '../services/auth.service'
import { CreateUserDto } from '../dto/create-user.dto'
import { LoginUserDto } from '../dto/login-user.dto'
import { UnauthorizedException } from '@nestjs/common'
import { Response } from 'express'

describe('UsersController', () => {
  let controller: UsersController
  let usersService: jest.Mocked<UsersService>
  let authService: jest.Mocked<AuthService>

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

      const mockResponse = {} as Response
      const result = await controller.register(createUserDto, mockResponse)
      expect(result).toEqual(mockUser)
      expect(usersService.registerUser).toHaveBeenCalledWith(createUserDto)
    })
  })

  describe('login', () => {
    it('should login a user with valid credentials', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      authService.validateUser.mockResolvedValue(mockUser)

      const mockResponse = {} as Response
      const result = await controller.login(loginDto, mockResponse)
      expect(result).toEqual(mockUser)
      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password)
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
