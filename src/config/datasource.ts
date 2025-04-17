import * as dotenv from 'dotenv'
import * as path from 'path'
import { DataSource, DataSourceOptions } from 'typeorm'

dotenv.config()

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ethereum_key_vault',

  // Нотация с glob, чтобы искало *.ts в src и *.js в dist
  entities: [path.join(__dirname, '../entities/*{.ts,.js}')],

  // Здесь обратите внимание: __dirname будет
  //  - src/config  при запуске через ts-node
  //  - dist/src/config при запуске через node dist/main.js
  migrations: [path.join(__dirname, '../migrations/*{.ts,.js}')],

  // CLI миграций сам применяет только migrations, без синхронизации
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
}

console.log('TypeORM DataSource options:', {
  host: dataSourceOptions.host,
  port: dataSourceOptions.port,
  database: dataSourceOptions.database,
  migrations: dataSourceOptions.migrations,
})

console.log('>> Trying DataSource.connect() to', {
  host: dataSourceOptions.host,
  port: dataSourceOptions.port,
  database: dataSourceOptions.database,
})

export default new DataSource(dataSourceOptions)
