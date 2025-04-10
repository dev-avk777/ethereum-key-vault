import { dataSourceOptions } from './src/config/datasource'
import { DataSource } from 'typeorm'

async function testConnection() {
  const dataSource = new DataSource(dataSourceOptions)
  await dataSource.initialize()
  console.log('Connection established successfully')

  // Выводим метаданные для сущности User
  const userMetadata = dataSource.entityMetadatas.find(metadata => metadata.name === 'User')
  if (userMetadata) {
    console.log('User entity metadata:', userMetadata)
    console.log(
      'Columns:',
      userMetadata.columns.map(col => ({
        propertyName: col.propertyName,
        databaseName: col.databaseName,
        type: col.type,
      }))
    )
  } else {
    console.log('User entity not found in metadata')
  }

  await dataSource.destroy()
  console.log('Connection closed')
}

testConnection().catch(error => {
  console.error('Connection failed:', error)
})
