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

  // Glob notation to find *.ts in src and *.js in dist
  entities: [path.join(__dirname, '../entities/*{.ts,.js}')],

  // Note that __dirname will be
  //  - src/config when running via ts-node
  //  - dist/src/config when running via node dist/main.js
  migrations: [path.join(__dirname, '../migrations/*{.ts,.js}')],

  // Migration CLI applies only migrations without synchronization
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
