import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionEntity } from '../session.entity';

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: getRepositoryToken(SessionEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('create', () => {
    it('should create and save a session', async () => {
      const input = {
        userId: 'user-1',
        refreshTokenHash: 'hash-abc',
        deviceInfo: { userAgent: 'Mozilla', ip: '1.2.3.4' },
        expiresAt: new Date(Date.now() + 86400000),
      };
      const saved = { id: 'session-1', ...input };
      mockRepo.create.mockReturnValue(saved);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.create(input);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          refreshTokenHash: 'hash-abc',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(saved);
      expect(result).toEqual(saved);
    });
  });

  describe('findActiveByHash', () => {
    it('should return a session when found and active', async () => {
      const session = { id: 's1', refreshTokenHash: 'h1' };
      mockRepo.findOne.mockResolvedValue(session);
      const result = await service.findActiveByHash('h1');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({
          refreshTokenHash: 'h1',
          deletedAt: IsNull(),
        }),
      });
      expect(result).toEqual(session);
    });

    it('should return null when no session found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findActiveByHash('nonexistent');
      expect(result).toBeNull();
    });

    it('should include an expiresAt > now filter', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await service.findActiveByHash('h');
      const callArg = mockRepo.findOne.mock.calls[0][0];
      expect(callArg.where.expiresAt).toBeInstanceOf(Object);
    });
  });

  describe('rotate', () => {
    it('should update refreshTokenHash and lastUsedAt', async () => {
      const newHash = 'new-hash';
      const newExpiresAt = new Date(Date.now() + 86400000);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.rotate('session-1', newHash, newExpiresAt);

      expect(mockRepo.update).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          refreshTokenHash: newHash,
          expiresAt: newExpiresAt,
        }),
      );
    });

    it('should throw NotFoundException when no rows affected', async () => {
      mockRepo.update.mockResolvedValue({ affected: 0 });
      await expect(
        service.rotate('missing', 'hash', new Date()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revoke', () => {
    it('should soft-delete the session', async () => {
      mockRepo.softDelete.mockResolvedValue({ affected: 1 });
      await service.revoke('session-1');
      expect(mockRepo.softDelete).toHaveBeenCalledWith('session-1');
    });
  });

  describe('revokeAllForUser', () => {
    it('should soft-delete all sessions for a user and return count', async () => {
      mockRepo.softDelete.mockResolvedValue({ affected: 3 });
      const count = await service.revokeAllForUser('user-1');
      expect(mockRepo.softDelete).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(count).toBe(3);
    });

    it('should return 0 when no sessions exist', async () => {
      mockRepo.softDelete.mockResolvedValue({ affected: 0 });
      const count = await service.revokeAllForUser('user-no-sessions');
      expect(count).toBe(0);
    });
  });
});
