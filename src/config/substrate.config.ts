import { registerAs } from '@nestjs/config'
import { Logger } from '@nestjs/common'

/**
 * Configuration for Substrate blockchain connections and operations.
 *
 * @returns {Object} Substrate configuration object
 */
export const substrateConfig = registerAs('substrate', () => {
  const logger = new Logger('SubstrateConfig')

  // Считываем конфигурацию из переменных окружения
  const rpcUrl = process.env.SUBSTRATE_RPC_URL || 'ws://127.0.0.1:9944'
  const ss58Prefix = parseInt(process.env.SUBSTRATE_SS58_PREFIX || '42', 10)
  const tokenId = process.env.SUBSTRATE_TOKEN_ID || 'OPAL'
  const useBalances = process.env.USE_BALANCES === 'true'

  // Логгируем для отладки
  logger.log(
    `Loading Substrate config: RPC=${rpcUrl}, SS58=${ss58Prefix}, Token=${tokenId}, UseBalances=${useBalances}`
  )
  logger.log(
    `Raw env values: SUBSTRATE_RPC_URL=${process.env.SUBSTRATE_RPC_URL}, USE_BALANCES=${process.env.USE_BALANCES}`
  )

  return {
    // URL for the Substrate node RPC endpoint
    rpcUrl,

    // The SS58 prefix to use for address encoding
    ss58Prefix,

    // The ID of the token to use for ORML tokens pallet
    // Common examples: 'OPAL', 'UNIQUE', etc.
    tokenId,

    // Whether to use balances pallet instead of tokens
    useBalances,
  }
})
