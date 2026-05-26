import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import type { IJwtAccessPayload } from '@jitre/shared';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueAccessToken(payload: IJwtAccessPayload): Promise<string> {
    const jwtConfig = this.config.get<{ accessTtl: string }>('jwt');
    const expiresIn = jwtConfig?.accessTtl ?? '15m';
    return this.jwtService.signAsync(payload, {
      expiresIn: expiresIn as unknown as number,
    });
  }

  issueRefreshToken(): { token: string; hash: string; expiresAt: Date } {
    const jwtConfig = this.config.get<{ refreshTtlMs: number }>('jwt');
    const ttlMs = jwtConfig?.refreshTtlMs ?? 7 * 24 * 60 * 60 * 1000;

    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMs);
    return { token, hash, expiresAt };
  }

  issueCsrfToken(): string {
    return randomBytes(16).toString('hex');
  }

  async verifyAccessToken(token: string): Promise<IJwtAccessPayload> {
    try {
      return await this.jwtService.verifyAsync<IJwtAccessPayload>(token);
    } catch {
      throw new UnauthorizedException('TOKEN_INVALID');
    }
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
