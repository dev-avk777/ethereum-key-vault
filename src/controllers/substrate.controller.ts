import { Controller, Get, Post, Body, Logger, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SubstrateService } from '../services/substrate.service'
import { TransferDto } from '../dto/transfer.dto'
import { GetUser } from '../decorators/get-user.decorator'
import { AuthGuard } from '@nestjs/passport'

@ApiTags('substrate')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('substrate')
export class SubstrateController {
  private readonly logger = new Logger(SubstrateController.name)

  constructor(private readonly substrateService: SubstrateService) {}

  @ApiOperation({ summary: 'Get Substrate balance of current user' })
  @Get('balance')
  async balance(@GetUser('id') userId: string) {
    const balance = await this.substrateService.getBalance(userId)
    this.logger.log(`Balance for ${userId}: ${balance}`)
    return { balance }
  }

  @ApiOperation({ summary: 'Transfer Substrate tokens' })
  @Post('transfer')
  async transfer(@GetUser('id') userId: string, @Body() dto: TransferDto) {
    const result = await this.substrateService.sendTokens(userId, dto.toAddress, dto.amount)
    this.logger.log(`Transfer for ${userId}: ${JSON.stringify(result)}`)
    return result
  }
}
