import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsString, IsOptional } from 'class-validator'

/**
 * DTO for token transfer operations
 */
export class TransferDto {
  @ApiProperty({
    description: 'Destination SS58 address',
    example: '5F3sa2TJcP...',
  })
  @IsString()
  toAddress: string

  @ApiProperty({
    description: 'Amount to transfer (in human units)',
    example: '100',
  })
  @IsString()
  amount: string

  @ApiPropertyOptional({
    description: 'Asset ID for ORML tokens pallet (fallback to SUBSTRATE_TOKEN_ID)',
    example: 'OPAL',
  })
  @IsOptional()
  @IsString()
  assetId?: string
}

/**
 * DTO for email-based token transfer operations (for external services)
 * Used exclusively in the EthereumController
 * for non-guaranteed email transfers.
 */
export class EmailTransferDto extends TransferDto {
  @ApiProperty({
    description: 'Email of the sender',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string
}
