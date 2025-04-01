import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Включаем CORS
  app.enableCors()

  // Включаем валидацию
  app.useGlobalPipes(new ValidationPipe())

  // Настройка Swagger
  const config = new DocumentBuilder()
    .setTitle('Ethereum Key Vault API')
    .setDescription('API для регистрации пользователей с генерацией Ethereum кошельков')
    .setVersion('1.0')
    .addTag('auth', 'Аутентификация')
    .addTag('users', 'Операции с пользователями')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  await app.listen(process.env.PORT ?? 3000)

  const url = await app.getUrl()
  console.log(`Application is running on: ${url}`)
  console.log(`Swagger documentation is available at: ${url}/api`)
}
bootstrap()
