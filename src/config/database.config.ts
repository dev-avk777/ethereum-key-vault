import { type TypeOrmModuleOptions } from '@nestjs/typeorm'
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
  password: process.env.POSTGRES_PASSWORD || '773TWI!Qu,q!',
  database: process.env.POSTGRES_DB || 'ethereum_key_vault',
  entities: [User],
  synchronize: true, // Внимание: синхронизация схемы рекомендуется только в development-окружении!
  logging: true,
  ssl: false,
  extra: {
    trustServerCertificate: true,
    max: 25,
    connectionTimeoutMillis: 10000,
  },
  autoLoadEntities: true,
}
