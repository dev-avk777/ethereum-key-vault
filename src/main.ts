import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ValidationPipe, Logger } from '@nestjs/common'
import * as cookieParser from 'cookie-parser'
import * as morgan from 'morgan'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // HTTP logging for each request
  app.use(morgan('dev'))

  // Handle cookies
  app.use(cookieParser())

  // CORS: allow only trusted sources, dedupe origins
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3007'
  const allowed = [
    'http://localhost:3000',
    'http://localhost:3007',
    'http://localhost:5173',
    frontendUrl,
  ]
  const origins = Array.from(new Set(allowed)) // remove duplicates
  const corsOptions = {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
  app.enableCors(corsOptions)

  // Log bootstrap info
  const logger = new Logger('Bootstrap')
  logger.log(`Running in ${process.env.NODE_ENV || 'development'} mode`)
  logger.log(`Allowed CORS origins: ${origins.join(', ')}`)

  // Global DTO validation and transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  )

  // Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ethereum Key Vault API')
    .setDescription('API for user registration and key management')
    .setVersion('1.0')
    .addCookieAuth('authToken')
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api', app, document)

  // Start server
  const port = parseInt(process.env.PORT || '5000', 10)
  await app.listen(port, '0.0.0.0')

  logger.log(`Application running on: http://localhost:${port}`)
  logger.log(`Swagger docs at: http://localhost:${port}/api`)
}

bootstrap()
