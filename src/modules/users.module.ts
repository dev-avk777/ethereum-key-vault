import { forwardRef, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LocalStrategy } from '../auth/local.strategy'
import { VaultConfigModule } from '../config/vault.config'
import { UsersController } from '../controllers/users.controller'
import { User } from '../entities/user.entity'
import { AuthService } from '../services/auth.service'
import { UsersService } from '../services/users.service'
import { VaultService, VaultServiceProvider } from '../services/vault.service'
import { EthereumModule } from './ethereum.module'
import { SubstrateModule } from './substrate.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    ConfigModule,
    VaultConfigModule,
    forwardRef(() => EthereumModule),
    forwardRef(() => SubstrateModule),
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
