import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

/**
 * Сущность пользователя.
 * Здесь хранится информация о пользователе: его уникальный id (в формате UUID),
 * email (уникальный для каждого пользователя), хешированный пароль и публичный ключ Ethereum.
 * Также хранится информация для Google OAuth аутентификации.
 * Автоматически сохраняется время создания записи.
 */
@Entity({ name: 'users' })
export class User {
  // Используем UUID в качестве уникального идентификатора пользователя
  @PrimaryGeneratedColumn('uuid')
  id: string

  // Email пользователя, должен быть уникальным
  @Column({ unique: true })
  email: string

  // Хешированный пароль, который будет храниться после шифрования с помощью bcrypt
  @Column({ nullable: true })
  password: string | null

  // Публичный ключ Ethereum (адрес кошелька)
  @Column({ unique: true })
  publicKey: string

  // Google OAuth поля
  @Column({ nullable: true, name: 'google_id' })
  googleId: string | null

  @Column({ nullable: true, name: 'display_name' })
  displayName: string | null

  // Автоматически сохраняем дату создания записи
  @CreateDateColumn()
  createdAt: Date
}
