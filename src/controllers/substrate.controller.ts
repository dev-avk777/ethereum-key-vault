import { Controller, Get, Post, Body, Logger, UseGuards, Header } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SubstrateService } from '../services/substrate.service'
import { TransferDto } from '../dto/transfer.dto'
import { GetUser } from '../decorators/get-user.decorator'
import { AuthGuard } from '@nestjs/passport'
import { ConfigService } from '@nestjs/config'

@ApiTags('substrate')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('substrate')
export class SubstrateController {
  private readonly logger = new Logger(SubstrateController.name)

  constructor(
    private readonly substrateService: SubstrateService,
    private readonly configService: ConfigService
  ) {}

  @ApiOperation({ summary: 'Get Substrate balance of current user' })
  @Get('balance')
  @Header('Cache-Control', 'no-store')
  async balance(@GetUser('id') userId: string) {
    const balance = await this.substrateService.getBalance(userId)
    this.logger.log(`Balance for ${userId}: ${balance}`)
    return { balance }
  }

  @ApiOperation({ summary: 'Get Substrate configuration for debugging' })
  @Get('config')
  async getConfig() {
    return {
      rpcUrl: this.configService.get<string>('substrate.rpcUrl'),
      tokenId: this.configService.get<string>('substrate.tokenId'),
      useBalances: this.configService.get<boolean>('substrate.useBalances'),
      ss58Prefix: this.configService.get<number>('substrate.ss58Prefix'),
      envUseBalances: process.env.USE_BALANCES,
      envRpcUrl: process.env.SUBSTRATE_RPC_URL,
      envTokenId: process.env.SUBSTRATE_TOKEN_ID,
    }
  }

  @ApiOperation({ summary: 'Transfer Substrate tokens' })
  @Post('transfer')
  async transfer(@GetUser('id') userId: string, @Body() dto: TransferDto) {
    const { toAddress, amount, assetId } = dto
    const result = await this.substrateService.sendTokens(userId, toAddress, amount, assetId)
    this.logger.log(`Transfer for ${userId}: ${JSON.stringify(result)}`)
    return result
  }
}
