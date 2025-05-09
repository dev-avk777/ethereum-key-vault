import { Body, Controller, Post, Query, Res, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { CreateUserDto } from '../dto/create-user.dto'
import { LoginUserDto } from '../dto/login-user.dto'
import { AuthService } from '../services/auth.service'
import { UsersService } from '../services/users.service'

@ApiTags('users')
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

  /**
   * Registers a new user on a given chain.
   * @param createUserDto - The data transfer object containing user information for registration.
   * @param chain - The blockchain type to generate the wallet on. Defaults to 'substrate'.
   * @param res - The response object to set cookies.
   * @returns The registered user's id, email, and public key.
   * @throws InternalServerErrorException if registration fails.
   */
  @ApiOperation({ summary: 'Register a new user on a given chain' })
  @ApiQuery({
    name: 'chain',
    enum: ['ethereum', 'substrate'],
    required: false,
    description: 'Which chain to generate the wallet on (defaults to substrate)',
  })
  @Post('register')
  async register(
    @Body() createUserDto: CreateUserDto,
    @Query('chain') chain: 'ethereum' | 'substrate' = 'substrate',
    @Res({ passthrough: true }) res: Response
  ) {
    const { id, email, publicKey, substratePublicKey } = await this.usersService.registerUser(
      createUserDto,
      chain
    )

    const unifiedKey = substratePublicKey ?? publicKey

    const token = this.jwtService.sign({
      id,
      email,
      publicKey: unifiedKey,
    })

    const isProd = this.configService.get('NODE_ENV') === 'production'
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    })

    return { id, email, publicKey: unifiedKey }
  }
}
