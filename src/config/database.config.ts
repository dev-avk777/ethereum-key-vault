import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'

/**
 * Конфигурация для подключения к базе данных PostgreSQL с использованием TypeORM.
 * Здесь указываются параметры подключения и сущности, которые будут использоваться.
 */
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ethereum_key_vault',
  entities: [User],
  // Синхронизация схемы только в режиме разработки
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  ssl: false,
  extra: {
    trustServerCertificate: process.env.NODE_ENV === 'development',
    max: 25,
    connectionTimeoutMillis: 10000,
  },
  autoLoadEntities: true,
}
