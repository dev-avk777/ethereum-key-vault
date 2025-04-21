import { TypeOrmModuleOptions } from '@nestjs/typeorm'

/**
 * Configuration for connecting to PostgreSQL database using TypeORM.
 * Here are specified connection parameters and entities that will be used.
 */
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ethereum_key_vault',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  // Schema synchronization only in development mode
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
