import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

const mockUserService = {
  findById: jest.fn(),
};

const mockRcService = {
  setUserId: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue({ access: { secret: 'test-secret' } }),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(
      mockConfigService as never,
      mockUserService as never,
      mockRcService as never,
    );
  });

  describe('validate', () => {
    it('should return user and set userId in RequestContext when user exists', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        status: 'active',
      };
      mockUserService.findById.mockResolvedValue(user);

      const result = await strategy.validate({
        sub: 'user-1',
        email: 'test@example.com',
      });

      expect(mockUserService.findById).toHaveBeenCalledWith('user-1');
      expect(mockRcService.setUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      mockUserService.findById.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'missing-user', email: 'ghost@example.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is disabled', async () => {
      mockUserService.findById.mockResolvedValue({
        id: 'user-2',
        email: 'disabled@example.com',
        status: 'disabled',
      });

      await expect(
        strategy.validate({ sub: 'user-2', email: 'disabled@example.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
