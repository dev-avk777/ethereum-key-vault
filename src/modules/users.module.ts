import { forwardRef, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { UsersService } from '../services/users.service'
import { VaultServiceProvider, VaultService } from '../services/vault.service'
import { UsersController } from '../controllers/users.controller'
import { AuthService } from '../services/auth.service'
import { LocalStrategy } from '../auth/local.strategy'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { VaultConfigModule } from '../config/vault.config'
import { EthereumModule } from './ethereum.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    ConfigModule,
    VaultConfigModule,
    forwardRef(() => EthereumModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [VaultServiceProvider, VaultService, UsersService, AuthService, LocalStrategy],
  exports: [UsersService, AuthService, VaultService],
})
export class UsersModule {}
