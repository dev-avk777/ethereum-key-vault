import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { GetUser } from '../decorators/get-user.decorator'
import { EmailTransferDto, TransferDto } from '../dto/transfer.dto'
import { Transaction } from '../entities/transaction.entity'
import { User } from '../entities/user.entity'
import { EthereumService } from '../services/ethereum.service'
import { UsersService } from '../services/users.service'

/**
 * Controller для работы с Ethereum/Opal транзакциями и балансами
 */
@ApiTags('ethereum')
@Controller('ethereum')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class EthereumController {
  constructor(
    private readonly usersService: UsersService,
    private readonly ethereumService: EthereumService,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>
  ) {}

  /**
   * GET /ethereum/keys
   * Возвращает публичный ключ (Ethereum address) текущего пользователя
   */
  @ApiOperation({ summary: 'Get Ethereum keys of the user' })
  @ApiBearerAuth()
  @Get('keys')
  @UseGuards(AuthGuard('jwt'))
  async getKeys(@Req() req: any) {
    const user = req.user as User
    let publicKey = user.publicKey

    if (!publicKey) {
      const fromDb = await this.usersService.findById(user.id)
      if (!fromDb?.publicKey) {
        throw new NotFoundException('Ethereum keys not found')
      }
      publicKey = fromDb.publicKey
    }

    return [
      {
        id: '1',
        publicKey,
        name: 'Primary Key',
        createdAt: new Date().toISOString(),
      },
    ]
  }

  /**
   * POST /ethereum/transfer
   * Перевод средств от авторизованного пользователя
   */
  @ApiOperation({ summary: 'Transfer tokens to another address' })
  @ApiBearerAuth()
  @Post('transfer')
  @UseGuards(AuthGuard('jwt'))
  async transfer(@GetUser() user: User, @Body() dto: TransferDto) {
    if (!user?.email) {
      throw new UnauthorizedException('Invalid user')
    }

    const isOAuth = !!user.googleId
    const tx = await this.ethereumService.sendNative(user.email, dto.toAddress, dto.amount, isOAuth)
    return { hash: tx.hash }
  }

  /**
   * POST /ethereum/transfer-by-email
   * Негарантированная отправка по email для внешних сервисов (бот)
   */
  @ApiOperation({ summary: 'Transfer tokens using email (for external services)' })
  @Post('transfer-by-email')
  async transferByEmail(@Body() dto: EmailTransferDto) {
    return this.usersService.sendTokensFromUser(dto.email, dto.toAddress, dto.amount, dto.isOAuth)
  }

  /**
   * GET /ethereum/transactions?address=
   * История транзакций для адреса (отправленные/полученные)
   */
  @ApiOperation({ summary: 'Get transaction history for an address' })
  @ApiQuery({ name: 'address', required: true, description: 'Ethereum address' })
  @Get('transactions')
  async getTransactions(@Query('address') address: string) {
    if (!address) {
      throw new BadRequestException('Query param "address" is required')
    }

    return this.transactionRepository.find({
      where: [{ userAddress: address }, { toAddress: address }],
      order: { timestamp: 'DESC' },
    })
  }

  /**
   * GET /ethereum/balance?address=
   * Проверка текущего баланса нативного токена (Opal)
   */
  @ApiOperation({ summary: 'Get native token balance for an address' })
  @Get('balance')
  async getBalance(@Query('address') address: string) {
    if (!address) {
      throw new BadRequestException('Query param "address" is required')
    }

    const balance = await this.ethereumService.getBalance(address)
    return { address, balance: `${balance} OPAL` }
  }
}
