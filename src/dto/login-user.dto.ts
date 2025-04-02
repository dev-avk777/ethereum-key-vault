import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginUserDto {
  @ApiProperty({
    description: 'Email пользователя',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string

  @ApiProperty({
    description: 'Пароль пользователя',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string
}
