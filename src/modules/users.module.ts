import { forwardRef, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LocalStrategy } from '../auth/local.strategy'
import { UsersController } from '../controllers/users.controller'
import { User } from '../entities/user.entity'
import { AuthService } from '../services/auth.service'
import { UsersService } from '../services/users.service'
import { EthereumModule } from './ethereum.module'
import { SubstrateModule } from './substrate.module'
import { VaultModule } from './vault.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    ConfigModule,
    VaultModule,
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
  providers: [UsersService, AuthService, LocalStrategy],
  exports: [UsersService, AuthService],
})
export class UsersModule {}
