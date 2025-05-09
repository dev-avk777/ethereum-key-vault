import { AccountInfo, Balance } from '@polkadot/types/interfaces'
import { ApiPromise } from '@polkadot/api'

/**
 * Converts the non-zero part of the balance into a readable string.
 * @param api — an instance of ApiPromise to get chainDecimals
 * @param account — the result of api.query.system.account(address)
 * @returns a string like "6.000123"
 */
export function formatBalance(api: ApiPromise, account: AccountInfo): string {
  const decimals = api.registry.chainDecimals[0]
  const freeBn = (account.data.free as Balance).toBigInt()
  const base = BigInt(10) ** BigInt(decimals)
  const integer = freeBn / base
  const remainder = freeBn % base

  const fracStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '')

  return fracStr ? `${integer.toString()}.${fracStr}` : integer.toString()
}

/**
 * Parses a string with a decimal fraction into Planck.
 * @param api — an instance of ApiPromise to get chainDecimals
 * @param human — a string like "1.23"
 * @returns a string of BigInt in minimal units, e.g. "1230000000000"
 */
export function parseBalance(api: ApiPromise, human: string): string {
  const decimals = api.registry.chainDecimals[0]
  const [intPart, fracPart = ''] = human.split('.')
  const base = BigInt(10) ** BigInt(decimals)

  const biInt = BigInt(intPart) * base
  const fracNormalized = (fracPart + '0'.repeat(decimals)).slice(0, decimals)
  const biFrac = BigInt(fracNormalized)

  return (biInt + biFrac).toString()
}
