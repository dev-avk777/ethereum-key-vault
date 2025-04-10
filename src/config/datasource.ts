import { DataSource, DataSourceOptions } from 'typeorm'
import * as dotenv from 'dotenv'
import { User } from '../entities/user.entity'

// Загрузка переменных окружения
dotenv.config()

// Настройки источника данных для миграций
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ethereum_key_vault',
  entities: [User],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // Отключаем синхронизацию для миграций
  logging: process.env.NODE_ENV === 'development',
}

// Создаем экземпляр DataSource для CLI миграций
const dataSource = new DataSource(dataSourceOptions)
export default dataSource
