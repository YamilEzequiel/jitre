import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AttachmentService } from '../attachment/attachment.service';

const mockUserService = {
  findById: jest.fn(),
};

const mockAttachmentService = {
  replaceAvatar: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: AttachmentService, useValue: mockAttachmentService },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  describe('getMe', () => {
    it('should return the current user from request.user', async () => {
      const user = {
        id: 'u1',
        email: 'a@b.com',
        displayName: 'AB',
        avatarUrl: null,
      };
      mockUserService.findById.mockResolvedValue(user);

      const req = { user: { id: 'u1' } };
      const result = await controller.getMe(req as never);

      expect(mockUserService.findById).toHaveBeenCalledWith('u1');
      expect(result).toEqual({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'AB',
        avatarUrl: null,
      });
    });

    it('should NOT include passwordHash in the response', async () => {
      const user = {
        id: 'u2',
        email: 'b@c.com',
        displayName: 'BC',
        avatarUrl: null,
        passwordHash: 'super-secret-hash',
      };
      mockUserService.findById.mockResolvedValue(user);

      const req = { user: { id: 'u2' } };
      const result = (await controller.getMe(req as never)) as Record<
        string,
        unknown
      >;

      expect(result.passwordHash).toBeUndefined();
    });
  });
});
