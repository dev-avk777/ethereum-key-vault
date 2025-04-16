import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ValidationPipe, Logger } from '@nestjs/common'
import * as cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Добавляем middleware для обработки cookie
  app.use(cookieParser())

  // Настройка CORS
  const corsOptions = {
    origin: [
      'http://localhost:3000',
      'http://localhost:3007',
      'http://localhost:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }

  app.enableCors(corsOptions)

  // Логирование разрешенных CORS-доменов
  const logger = new Logger('CORS')
  logger.log(`Allowed CORS origins: ${corsOptions.origin.join(', ')}`)

  // Включаем валидацию
  app.useGlobalPipes(new ValidationPipe())

  // Настройка Swagger
  const config = new DocumentBuilder()
    .setTitle('Ethereum Key Vault API')
    .setDescription('API для регистрации пользователей с генерацией Ethereum кошельков')
    .setVersion('1.0')
    .addTag('auth', 'Аутентификация')
    .addTag('users', 'Операции с пользователями')
    .addTag('ethereum', 'Операции с Ethereum')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0') // Слушаем на всех интерфейсах

  const url = await app.getUrl()
  console.log(`Application is running on: ${url}`)
  console.log(`Swagger documentation is available at: ${url}/api`)
  console.log(`CORS origins allowed: ${app.getHttpAdapter().getInstance()._options.cors.origin}`)
}
bootstrap()
