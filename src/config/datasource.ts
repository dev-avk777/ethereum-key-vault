import { DataSource, DataSourceOptions } from 'typeorm'
import * as dotenv from 'dotenv'
import { User } from '../entities/user.entity' // Убедитесь, что путь правильный
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')

dotenv.config()

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: 'postgres',
  database: 'ethereum_key_vault',
  entities: [User],
  migrations: [path.join(__dirname, '..', '..', 'dist', 'src', 'migrations', '*.js')],
  synchronize: false,
  logging: true,
}

console.log('Database connection options:', {
  host: dataSourceOptions.host,
  port: dataSourceOptions.port,
  username: dataSourceOptions.username,
  password: dataSourceOptions.password,
  database: dataSourceOptions.database,
})

const dataSource = new DataSource(dataSourceOptions)
export default dataSource
