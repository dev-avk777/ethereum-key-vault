import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ValidationPipe, Logger } from '@nestjs/common'
import * as cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Обрабатываем cookie
  app.use(cookieParser())

  // CORS: разрешаем только доверенные источники
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3007'
  const corsOptions = {
    origin: ['http://localhost:3000', frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
  app.enableCors(corsOptions)

  // Логируем, какие origin разрешены
  const logger = new Logger('Bootstrap')
  logger.log(`Allowed CORS origins: ${corsOptions.origin.join(', ')}`)

  // Глобальная валидация DTO
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ethereum Key Vault API')
    .setDescription('API для регистрации пользователей и управления ключами')
    .setVersion('1.0')
    .addCookieAuth('authToken')
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api', app, document)

  // Старт сервера
  const port = parseInt(process.env.PORT || '5000', 10)
  await app.listen(port, '0.0.0.0')

  logger.log(`Application running on: http://localhost:${port}`)
  logger.log(`Swagger docs at: http://localhost:${port}/api`)
}

bootstrap()
