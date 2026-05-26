import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PasswordHasherService } from './password-hasher.service';

const mockConfigService = {
  get: jest.fn().mockReturnValue({
    memoryCost: 4096,
    timeCost: 2,
    parallelism: 1,
  }),
};

describe('PasswordHasherService', () => {
  let service: PasswordHasherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordHasherService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PasswordHasherService>(PasswordHasherService);
  });

  describe('hash', () => {
    it('should return a string starting with $argon2id$', async () => {
      const result = await service.hash('ValidPassword1!');
      expect(result).toMatch(/^\$argon2id\$/);
    });

    it('should produce a different hash each call (random salt)', async () => {
      const h1 = await service.hash('SamePassword1!');
      const h2 = await service.hash('SamePassword1!');
      expect(h1).not.toBe(h2);
    });

    it('should produce a non-empty string', async () => {
      const result = await service.hash('AnyPass1!');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('verify', () => {
    it('should return true for the correct password', async () => {
      const password = 'CorrectPass1!';
      const hash = await service.hash(password);
      const result = await service.verify(hash, password);
      expect(result).toBe(true);
    });

    it('should return false for an incorrect password', async () => {
      const hash = await service.hash('CorrectPass1!');
      const result = await service.verify(hash, 'WrongPass1!');
      expect(result).toBe(false);
    });

    it('should return false for a malformed hash without throwing', async () => {
      const result = await service.verify(
        'not-a-valid-argon2-hash',
        'anyPassword',
      );
      expect(result).toBe(false);
    });

    it('should return false for empty string hash without throwing', async () => {
      const result = await service.verify('', 'anyPassword');
      expect(result).toBe(false);
    });
  });
});
