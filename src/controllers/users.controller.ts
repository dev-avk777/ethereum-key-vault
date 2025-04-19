import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Res,
  InternalServerErrorException,
} from '@nestjs/common'
import { Response } from 'express'
import { UsersService } from '../services/users.service'
import { AuthService } from '../services/auth.service'
import { LoginUserDto } from '../dto/login-user.dto'
import { CreateUserDto } from '../dto/create-user.dto'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginUserDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password)

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      publicKey: user.publicKey,
    })

    const isProd = this.configService.get('NODE_ENV') === 'production'
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    })

    return { id: user.id, email: user.email, displayName: user.displayName }
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.usersService.registerUser(createUserDto)

    if (!user) {
      throw new InternalServerErrorException('Registration failed')
    }

    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
      publicKey: user.publicKey,
    })

    const isProd = this.configService.get('NODE_ENV') === 'production'
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    })

    return { id: user.id, email: user.email }
  }
}
