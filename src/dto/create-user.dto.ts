/**
 * Data Transfer Object for user registration.
 * Here we expect only email and password that are provided by the client.
 */
import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateUserDto {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'securePassword123',
  })
  @IsString()
  @MinLength(6)
  password: string
}
