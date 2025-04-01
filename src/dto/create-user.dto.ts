/**
 * Data Transfer Object для регистрации пользователя.
 * Здесь ожидаются только email и пароль, которые предоставляются клиентом.
 */
export class CreateUserDto {
  email: string
  password: string
}
