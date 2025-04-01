/**
 * Data Transfer Object для регистрации пользователя.
 * Здесь ожидаются только email и пароль, которые предоставляются клиентом.
 */
import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateUserDto {
  @ApiProperty({
    description: 'Email пользователя',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string

  @ApiProperty({
    description: 'Пароль пользователя (минимум 6 символов)',
    example: 'securePassword123',
  })
  @IsString()
  @MinLength(6)
  password: string
}
