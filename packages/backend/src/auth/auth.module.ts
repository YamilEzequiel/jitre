import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { SessionEntity } from './session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordHasherService } from './services/password-hasher.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenancyInterceptor } from './interceptors/tenancy.interceptor';
import { CaslAbilityFactory } from './casl/ability.factory';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwt = config.get<{ access: { secret: string; ttl: string } }>(
          'jwt',
        );
        return {
          secret:
            jwt?.access?.secret ?? 'dev_access_secret_change_me_change_me',
          signOptions: {
            expiresIn: (jwt?.access?.ttl ?? '15m') as unknown as number,
          },
        };
      },
    }),
    UserModule,
    WorkspaceModule,
    forwardRef(() => ProjectModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasherService,
    TokenService,
    SessionService,
    JwtStrategy,
    CaslAbilityFactory,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenancyInterceptor,
    },
  ],
  exports: [
    AuthService,
    TokenService,
    SessionService,
    CaslAbilityFactory,
    JwtModule,
  ],
})
export class AuthModule {}
