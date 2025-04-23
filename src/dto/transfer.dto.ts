import {
  IsEthereumAddress,
  IsString,
  Matches,
  IsEmail,
  IsBoolean,
  IsOptional,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * DTO for token transfer operations
 */
export class TransferDto {
  @ApiProperty({
    description: 'Destination Ethereum address',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsEthereumAddress()
  toAddress: string

  @ApiProperty({
    description: 'Amount to transfer (in ETH/token units)',
    example: '0.01',
  })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Amount must be a valid decimal number' })
  amount: string
}

/**
 * DTO for email-based token transfer operations (for external services)
 */
export class EmailTransferDto extends TransferDto {
  @ApiProperty({
    description: 'Email of the sender',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string

  @ApiProperty({
    description: 'Whether the user authenticated via OAuth',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isOAuth: boolean = false
}
