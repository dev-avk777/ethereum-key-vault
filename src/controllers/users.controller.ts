import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common'
import { type UsersService } from '../services/users.service'
import { type CreateUserDto } from '../dto/create-user.dto'
import { AuthGuard } from '@nestjs/passport'

/**
 * UsersController обрабатывает HTTP-запросы, связанные с пользователями.
 * Здесь реализованы два эндпоинта:
 * - POST /users/register для регистрации нового пользователя.
 * - POST /users/login для аутентификации (логина) с использованием локальной стратегии Passport.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
   * Использует AuthGuard с локальной стратегией, который проводит валидацию учетных данных.
   * Если аутентификация проходит успешно, возвращается сообщение с информацией о пользователе.
   */
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req) {
    // На этом этапе пользователь аутентифицирован, и данные пользователя доступны через req.user
    return { message: 'Login successful', user: req.user }
  }
}
