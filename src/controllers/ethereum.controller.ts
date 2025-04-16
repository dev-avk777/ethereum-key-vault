import { Controller, Get, Req, UseGuards, NotFoundException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request } from 'express'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from '../services/users.service'

interface JwtUser {
  id: string
  email: string
  googleId?: string
  displayName?: string
  publicKey?: string
}

/**
 * EthereumController обрабатывает запросы, связанные с Ethereum-ключами пользователей.
 * Предоставляет эндпоинт для получения публичного ключа (адреса Ethereum) пользователя.
 */
@ApiTags('ethereum')
@Controller('ethereum')
export class EthereumController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Получает публичный ключ (адрес Ethereum) текущего аутентифицированного пользователя.
   * Требует JWT-аутентификации.
   */
  @ApiOperation({ summary: 'Получить Ethereum-ключи пользователя' })
  @ApiBearerAuth()
  @Get('keys')
  @UseGuards(AuthGuard('jwt'))
  async getKeys(@Req() req: Request) {
    const user = req.user as JwtUser
    let publicKey: string

    // Если публичный ключ есть в JWT токене, используем его
    if (user.publicKey) {
      publicKey = user.publicKey
    } else {
      // Если публичного ключа нет в JWT токене, получаем его из базы данных
      const userFromDb = await this.usersService.findById(user.id)

      if (!userFromDb || !userFromDb.publicKey) {
        throw new NotFoundException('Ethereum keys not found for this user')
      }

      publicKey = userFromDb.publicKey
    }

    // Возвращаем массив с одним объектом, чтобы фронтенд мог использовать методы массива
    return [
      {
        id: '1', // Используем фиксированный id, так как у нас только один ключ на пользователя
        publicKey: publicKey,
        name: 'Primary Key', // Добавляем имя по умолчанию
        createdAt: new Date().toISOString(), // Добавляем текущую дату как дату создания
      },
    ]
  }
}
