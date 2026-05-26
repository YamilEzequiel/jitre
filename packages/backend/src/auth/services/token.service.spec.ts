import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { TokenService } from './token.service';
import { IJwtAccessPayload } from '@jitre/shared';

const mockJwtService = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'jwt') {
      return {
        accessTtl: '15m',
        refreshTtl: '7d',
        refreshTtlMs: 7 * 24 * 60 * 60 * 1000,
      };
    }
    return undefined;
  }),
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  describe('issueAccessToken', () => {
    it('should call jwtService.signAsync with the payload', async () => {
      mockJwtService.signAsync.mockResolvedValue('signed.jwt.token');
      const payload: IJwtAccessPayload = { sub: 'user-1', email: 'a@b.com' };
      const result = await service.issueAccessToken(payload);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        payload,
        expect.any(Object),
      );
      expect(result).toBe('signed.jwt.token');
    });

    it('should pass expiresIn from config', async () => {
      mockJwtService.signAsync.mockResolvedValue('token');
      await service.issueAccessToken({ sub: 'u', email: 'a@b.com' });
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '15m' }),
      );
    });
  });

  describe('issueRefreshToken', () => {
    it('should return a token of 64 hex chars (32 bytes)', () => {
      const { token } = service.issueRefreshToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should return a hash that is a SHA-256 of the token', () => {
      const { token, hash } = service.issueRefreshToken();
      const expected = createHash('sha256').update(token).digest('hex');
      expect(hash).toBe(expected);
    });

    it('should return a future expiresAt', () => {
      const { expiresAt } = service.issueRefreshToken();
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should produce different tokens on each call', () => {
      const r1 = service.issueRefreshToken();
      const r2 = service.issueRefreshToken();
      expect(r1.token).not.toBe(r2.token);
    });
  });

  describe('issueCsrfToken', () => {
    it('should return a 32 hex char string (16 bytes)', () => {
      const result = service.issueCsrfToken();
      expect(result).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should produce different tokens on each call', () => {
      const t1 = service.issueCsrfToken();
      const t2 = service.issueCsrfToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('verifyAccessToken', () => {
    it('should return the decoded payload on valid token', async () => {
      const payload: IJwtAccessPayload = { sub: 'user-1', email: 'a@b.com' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);
      const result = await service.verifyAccessToken('valid.token');
      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
      await expect(service.verifyAccessToken('bad.token')).rejects.toThrow();
    });
  });

  describe('hashRefreshToken', () => {
    it('should return the SHA-256 hex digest of the input', () => {
      const raw = 'somerawtoken';
      const expected = createHash('sha256').update(raw).digest('hex');
      expect(service.hashRefreshToken(raw)).toBe(expected);
    });

    it('should be deterministic', () => {
      const h1 = service.hashRefreshToken('token');
      const h2 = service.hashRefreshToken('token');
      expect(h1).toBe(h2);
    });
  });
});
