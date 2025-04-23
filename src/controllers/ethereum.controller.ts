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
import { Request } from 'express'
import { Repository } from 'typeorm'
import { GetUser } from '../decorators/get-user.decorator'
import { EmailTransferDto, TransferDto } from '../dto/transfer.dto'
import { Transaction } from '../entities/transaction.entity'
import { User } from '../entities/user.entity'
import { EthereumService } from '../services/ethereum.service'
import { UsersService } from '../services/users.service'

interface JwtUser {
  id: string
  email: string
  googleId?: string
  displayName?: string
  publicKey?: string
}

/**
 * EthereumController handles requests related to users' Ethereum keys and transactions.
 */
@ApiTags('ethereum')
@Controller('ethereum')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class EthereumController {
  constructor(
    private readonly usersService: UsersService,
    private readonly ethereumService: EthereumService,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>
  ) {}

  /**
   * Gets the public key (Ethereum address) of the currently authenticated user.
   * Requires JWT authentication.
   */
  @ApiOperation({ summary: 'Get Ethereum keys of the user' })
  @ApiBearerAuth()
  @Get('keys')
  @UseGuards(AuthGuard('jwt'))
  async getKeys(@Req() req: Request) {
    const user = req.user as JwtUser
    let publicKey: string

    // If public key exists in JWT token, use it
    if (user.publicKey) {
      publicKey = user.publicKey
    } else {
      // If public key doesn't exist in JWT token, get it from database
      const userFromDb = await this.usersService.findById(user.id)

      if (!userFromDb || !userFromDb.publicKey) {
        throw new NotFoundException('Ethereum keys not found for this user')
      }

      publicKey = userFromDb.publicKey
    }

    // Return an array with one object so frontend can use array methods
    return [
      {
        id: '1', // Use fixed id since we only have one key per user
        publicKey: publicKey,
        name: 'Primary Key', // Add default name
        createdAt: new Date().toISOString(), // Add current date as creation date
      },
    ]
  }

  /**
   * Transfer tokens from the authenticated user's wallet to another address
   */
  @ApiOperation({ summary: 'Transfer tokens to another address' })
  @ApiBearerAuth()
  @Post('transfer')
  @UseGuards(AuthGuard('jwt'))
  async transfer(@GetUser() user: User, @Body() transferDto: TransferDto) {
    if (!user || !user.email) {
      throw new UnauthorizedException('Invalid user')
    }

    try {
      // Check if the user authenticated via Google
      const isOAuth = !!user.googleId

      const tx = await this.ethereumService.sendNative(
        user.email,
        transferDto.toAddress,
        transferDto.amount,
        isOAuth
      )
      return { hash: tx.hash }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('insufficient funds')) {
        throw new BadRequestException('Insufficient funds for this transaction')
      }
      throw error
    }
  }

  /**
   * API endpoint for non-authenticated transfers (for Telegram bot)
   */
  @ApiOperation({ summary: 'Transfer tokens using email (for external services)' })
  @Post('transfer-by-email')
  async transferByEmail(@Body() emailTransferDto: EmailTransferDto) {
    try {
      return this.usersService.sendTokensFromUser(
        emailTransferDto.email,
        emailTransferDto.toAddress,
        emailTransferDto.amount,
        emailTransferDto.isOAuth
      )
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('insufficient funds')) {
        throw new BadRequestException('Insufficient funds for this transaction')
      } else if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(error.message)
      }
      throw error
    }
  }

  /**
   * Get transaction history for an address
   */
  @ApiOperation({ summary: 'Get transaction history for an address' })
  @ApiQuery({ name: 'address', required: true, description: 'Ethereum address' })
  @Get('transactions')
  async getTransactions(@Query('address') address: string) {
    if (!address) {
      throw new NotFoundException('Address is required')
    }

    return this.transactionRepository.find({
      where: [{ userAddress: address }, { toAddress: address }],
      order: { timestamp: 'DESC' },
    })
  }
}
