import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  logoutByToken: jest.fn(),
  logoutAll: jest.fn(),
};

const makeRes = () => {
  const cookies: Record<string, unknown> = {};
  const cleared: string[] = [];
  return {
    cookie: jest.fn((name: string, value: string, opts: unknown) => {
      cookies[name] = { value, opts };
    }),
    clearCookie: jest.fn((name: string) => {
      cleared.push(name);
    }),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    _cookies: cookies,
    _cleared: cleared,
  };
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  cookies: {},
  headers: { 'user-agent': 'Jest/1.0' },
  ip: '127.0.0.1',
  ...overrides,
});

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should set refresh and csrf cookies and return user + accessToken', async () => {
      const result = {
        user: { id: 'u1', email: 'a@b.com', displayName: 'AB' },
        workspace: { id: 'w1', name: 'Workspace' },
        accessToken: 'at',
        refreshToken: 'rt',
        csrfToken: 'ct',
      };
      mockAuthService.register.mockResolvedValue(result);

      const res = makeRes();
      const req = makeReq();
      const dto = {
        email: 'a@b.com',
        password: 'ValidPass1!',
        displayName: 'AB',
      };

      const response = await controller.register(
        dto,
        res as never,
        req as never,
      );

      expect(mockAuthService.register).toHaveBeenCalledWith(
        dto,
        expect.objectContaining({ ip: '127.0.0.1' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'rt',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/api/v1/auth',
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'csrf_token',
        'ct',
        expect.objectContaining({ httpOnly: false, sameSite: 'strict' }),
      );
      expect(response).toEqual({
        user: result.user,
        workspace: result.workspace,
        accessToken: 'at',
      });
    });
  });

  describe('login', () => {
    it('should set cookies and return user + accessToken on successful login', async () => {
      const result = {
        user: { id: 'u1', email: 'a@b.com', displayName: 'AB' },
        workspace: { id: 'w1', name: 'Workspace' },
        accessToken: 'at2',
        refreshToken: 'rt2',
        csrfToken: 'ct2',
      };
      mockAuthService.login.mockResolvedValue(result);

      const res = makeRes();
      const req = makeReq();
      const dto = { email: 'a@b.com', password: 'ValidPass1!' };

      const response = await controller.login(dto, res as never, req as never);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        'a@b.com',
        'ValidPass1!',
        expect.objectContaining({ ip: '127.0.0.1' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'rt2',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'csrf_token',
        'ct2',
        expect.any(Object),
      );
      expect(response).toEqual({
        user: result.user,
        workspace: result.workspace,
        accessToken: 'at2',
      });
    });
  });

  describe('refresh', () => {
    it('should rotate refresh cookie and return new access token', async () => {
      const result = {
        user: { id: 'u1', email: 'a@b.com', displayName: 'AB' },
        workspace: { id: 'w1', name: 'Workspace' },
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        csrfToken: 'new-ct',
      };
      mockAuthService.refresh.mockResolvedValue(result);

      const res = makeRes();
      const req = makeReq({ cookies: { refresh_token: 'old-rt' } });

      const response = await controller.refresh(res as never, req as never);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        'old-rt',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-rt',
        expect.any(Object),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'csrf_token',
        expect.objectContaining({ path: '/api/v1/auth' }),
      );
      expect(response).toEqual({
        user: result.user,
        workspace: result.workspace,
        accessToken: 'new-at',
      });
    });
  });

  describe('logout', () => {
    it('should call logoutByToken and clear cookies', async () => {
      mockAuthService.logoutByToken.mockResolvedValue(undefined);
      const res = makeRes();
      const req = makeReq({ cookies: { refresh_token: 'old-rt' } });

      await controller.logout(res as never, req as never);

      expect(mockAuthService.logoutByToken).toHaveBeenCalledWith('old-rt');
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(Object),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(Object),
      );
    });
  });

  describe('logoutAll', () => {
    it('should revoke all sessions and clear cookies', async () => {
      mockAuthService.logoutAll.mockResolvedValue(undefined);
      const res = makeRes();
      const req = makeReq({ user: { id: 'u1' } });

      await controller.logoutAll(res as never, req as never);

      expect(mockAuthService.logoutAll).toHaveBeenCalledWith('u1');
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });
});
