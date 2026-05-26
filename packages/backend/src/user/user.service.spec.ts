import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UserService } from './user.service';
import { UserEntity } from './user.entity';

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('findByEmail', () => {
    it('should return a user when found', async () => {
      const user = { id: 'u1', email: 'test@example.com' };
      mockRepo.findOne.mockResolvedValue(user);
      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(user);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('missing@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      const user = { id: 'u1', email: 'a@b.com' };
      mockRepo.findOne.mockResolvedValue(user);
      const result = await service.findById('u1');
      expect(result).toEqual(user);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('should return null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and save a user', async () => {
      const input = {
        email: 'new@example.com',
        passwordHash: 'hash',
        displayName: 'New User',
      };
      const saved = { id: 'u2', ...input, status: 'active' };
      mockRepo.create.mockReturnValue(saved);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.create(input);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
      expect(mockRepo.save).toHaveBeenCalledWith(saved);
      expect(result).toEqual(saved);
    });

    it('should throw ConflictException on unique email violation', async () => {
      mockRepo.create.mockReturnValue({});
      const dbError = new QueryFailedError('', [], {
        code: '23505',
      } as unknown as Error);
      mockRepo.save.mockRejectedValue(dbError);

      await expect(
        service.create({
          email: 'dup@e.com',
          passwordHash: 'h',
          displayName: 'D',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-unique errors', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.create({
          email: 'a@b.com',
          passwordHash: 'h',
          displayName: 'D',
        }),
      ).rejects.toThrow('DB connection lost');
    });
  });

  describe('updateLastLoginAt', () => {
    it('should update the lastLoginAt field', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 });
      await service.updateLastLoginAt('u1');
      expect(mockRepo.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
    });
  });
});
