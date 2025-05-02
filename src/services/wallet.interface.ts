/**
 * Interface for wallet generation and token transfer.
 * identifier — a string used by the implementation to determine the path in Vault
 *    • Ethereum: email
 *    • Substrate: userId
 */
export interface IWalletService {
  /**
   * Generates a new wallet, saves the secret (privateKey or mnemonic) in Vault
   * and returns the public address.
   * @param identifier — email (for ETH) or userId (for Substrate)
   * @returns A promise that resolves to an object containing the public address and privateKey.
   */
  generateWallet(identifier: string): Promise<{ address: string; privateKey: string }>

  /**
   * Sends tokens from the wallet associated with the identifier to the address `to`.
   * @param identifier — email (for ETH) or userId (for Substrate)
   * @param to — the recipient's address
   * @param amount — a string representing the amount (ETH or base units for Substrate)
   * @returns A promise that resolves to an object containing the transaction hash.
   */
  sendTokens(identifier: string, to: string, amount: string): Promise<{ hash: string }>
}
