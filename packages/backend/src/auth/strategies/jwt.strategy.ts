import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { IJwtAccessPayload } from '@jitre/shared';
import { UserService } from '../../user/user.service';
import { RequestContextService } from '../../request-context/request-context.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly userService: UserService,
    private readonly requestContext: RequestContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<{ access: { secret: string } }>('jwt')?.access?.secret ??
        'dev_access_secret_change_me_change_me',
    });
  }

  async validate(payload: IJwtAccessPayload): Promise<unknown> {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('TOKEN_INVALID');
    }
    if (user.status === 'disabled') {
      throw new UnauthorizedException('ACCOUNT_DISABLED');
    }
    this.requestContext.setUserId(user.id);
    return user;
  }
}
