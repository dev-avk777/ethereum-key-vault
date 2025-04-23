import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { dataSourceOptions } from './datasource'

/**
 * Configuration for connecting to PostgreSQL database using TypeORM.
 * Uses the same base options as dataSourceOptions to avoid duplication.
 */
export const databaseConfig: TypeOrmModuleOptions = {
  ...dataSourceOptions,
  // Override specific options for the application
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  autoLoadEntities: true,
  extra: {
    trustServerCertificate: process.env.NODE_ENV === 'development',
    max: 25,
    connectionTimeoutMillis: 10000,
  },
}
