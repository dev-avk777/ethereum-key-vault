import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'

// Определяем интерфейс для JWT payload
interface JwtPayload {
  id: string
  email: string
  googleId?: string
  displayName?: string
  publicKey?: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET')

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables')
    }

    super({
      jwtFromRequest: (req: Request) => {
        // Пытаемся извлечь токен из куки authToken
        if (req && req.cookies && req.cookies.authToken) {
          return req.cookies.authToken
        }
        // Если в куках нет, то пробуем взять из заголовка Authorization
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req)
      },
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    })
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Возвращаем объект с полями из JWT токена
    return {
      id: payload.id,
      email: payload.email,
      googleId: payload.googleId,
      displayName: payload.displayName,
      publicKey: payload.publicKey,
    }
  }
}
