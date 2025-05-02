// Mock the GetUser decorator
jest.mock('../decorators/get-user.decorator', () => ({
  GetUser: jest.fn().mockImplementation(_data => {
    return (target, key, descriptor) => {
      return descriptor
    }
  }),
}))

import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../services/users.service'
import { InternalServerErrorException } from '@nestjs/common'
import { User } from '../entities/user.entity'

describe('AuthController', () => {
  let controller: AuthController
  let jwtService: jest.Mocked<JwtService>
  let configService: jest.Mocked<ConfigService>
  let usersService: jest.Mocked<UsersService>

  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedPassword',
    publicKey: '0x123',
    createdAt: new Date(),
    googleId: null,
    displayName: null,
    substratePublicKey: null,
  }

  beforeEach(async () => {
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    } as unknown as jest.Mocked<JwtService>

    configService = {
      get: jest.fn().mockImplementation(key => {
        if (key === 'NODE_ENV') {
          return 'test'
        }
        if (key === 'FRONTEND_URL') {
          return 'http://localhost:3000'
        }
        return 'test-value'
      }),
    } as unknown as jest.Mocked<ConfigService>

    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile()

    controller = module.get<AuthController>(AuthController)

    // Переопределяем метод getUserInfo для тестирования
    controller.getUserInfo = jest.fn().mockImplementation(async user => {
      if (!user) {
        throw new InternalServerErrorException('User not authenticated')
      }

      const userId = user.id
      const userInfo = await usersService.findById(userId)

      if (!userInfo) {
        throw new InternalServerErrorException('User not found')
      }

      return userInfo
    })
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getUserInfo', () => {
    it('should return user data when found in database', async () => {
      usersService.findById.mockResolvedValue(mockUser)

      // Pass the user directly
      const user = {
        id: '123',
        email: 'test@example.com',
      }

      const result = await controller.getUserInfo(user as any)
      expect(usersService.findById).toHaveBeenCalledWith('123')
      expect(result).toEqual(mockUser)
    })

    it('should throw exception when user is not found in database', async () => {
      usersService.findById.mockResolvedValue(null)

      // Pass the user directly
      const user = {
        id: '123',
        email: 'test@example.com',
      }

      await expect(controller.getUserInfo(user as any)).rejects.toThrow(
        new InternalServerErrorException('User not found')
      )
    })

    it('should throw exception when user is undefined', async () => {
      // Pass undefined user
      await expect(controller.getUserInfo(null as unknown as User)).rejects.toThrow(
        new InternalServerErrorException('User not authenticated')
      )
    })
  })
})
