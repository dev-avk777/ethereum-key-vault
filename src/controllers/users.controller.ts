import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common'
import { UsersService } from '../services/users.service'
import { CreateUserDto } from '../dto/create-user.dto'
import { LoginUserDto } from '../dto/login-user.dto'
import { AuthService } from '../services/auth.service'

/**
 * UsersController обрабатывает HTTP-запросы, связанные с пользователями.
 * Здесь реализованы два эндпоинта:
 * - POST /users/register для регистрации нового пользователя.
 * - POST /users/login для аутентификации пользователя.
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}

  /**
   * Эндпоинт для регистрации пользователя.
   * Принимает email и пароль, генерирует Ethereum-кошелёк и сохраняет данные.
   */
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.registerUser(createUserDto)
  }

  /**
   * Эндпоинт для логина пользователя.
   * Проверяет учетные данные и возвращает информацию о пользователе.
   * Если аутентификация не удалась, выбрасывает UnauthorizedException.
   */
  @Post('login')
  async login(@Body() loginDto: LoginUserDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }
    return user
  }
}
