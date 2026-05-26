import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { Comment } from './comment.entity';
import { CommentContext, WorkspaceRole } from '@jitre/shared';
import { EventBusService } from '../events/event-bus.service';
import { MentionParser } from '../mention/mention-parser.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'C1',
    workspaceId: 'W1',
    contextType: CommentContext.TASK,
    contextId: 'T1',
    authorUserId: 'U1',
    body: 'Hello world',
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  };
}

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  softDelete: jest.fn(),
  update: jest.fn(),
};

const mockEventBus = { publish: jest.fn() };
const mockMentionParser = { parse: jest.fn() };

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // default: parser returns empty
    mockMentionParser.parse.mockReturnValue({ userIds: [] });

    const module = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: getRepositoryToken(Comment), useValue: mockRepo },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: MentionParser, useValue: mockMentionParser },
      ],
    }).compile();

    service = module.get(CommentService);
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a root-level comment and emits CommentCreatedEvent', async () => {
      const saved = makeComment();
      mockRepo.create.mockReturnValueOnce(saved);
      mockRepo.save.mockResolvedValueOnce(saved);
      mockMentionParser.parse.mockReturnValue({ userIds: ['U2'] });

      const result = await service.create({
        workspaceId: 'W1',
        contextType: CommentContext.TASK,
        contextId: 'T1',
        authorUserId: 'U1',
        body: 'Hello @[Bob](U2)',
      });

      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2); // CommentCreated + MentionCreated
      expect(result.id).toBe('C1');
    });

    it('creates a reply when parentId provided and parent is root (parentId null)', async () => {
      const parent = makeComment({ id: 'C_ROOT', parentId: null });
      const reply = makeComment({ id: 'C_REPLY', parentId: 'C_ROOT' });

      // findOne for parent fetch
      mockRepo.findOne.mockResolvedValueOnce(parent);
      mockRepo.create.mockReturnValueOnce(reply);
      mockRepo.save.mockResolvedValueOnce(reply);

      const result = await service.create({
        workspaceId: 'W1',
        contextType: CommentContext.TASK,
        contextId: 'T1',
        authorUserId: 'U1',
        body: 'Reply',
        parentId: 'C_ROOT',
      });

      expect(result.parentId).toBe('C_ROOT');
    });

    it('throws BadRequestException(MAX_THREAD_DEPTH) when parent is already a reply', async () => {
      // parent itself has a parentId → depth would exceed 2
      const nestedParent = makeComment({ id: 'C_REPLY', parentId: 'C_ROOT' });
      mockRepo.findOne.mockResolvedValueOnce(nestedParent);

      await expect(
        service.create({
          workspaceId: 'W1',
          contextType: CommentContext.TASK,
          contextId: 'T1',
          authorUserId: 'U1',
          body: 'Deep reply',
          parentId: 'C_REPLY',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when parentId provided but parent not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({
          workspaceId: 'W1',
          contextType: CommentContext.TASK,
          contextId: 'T1',
          authorUserId: 'U1',
          body: 'Orphan reply',
          parentId: 'NONEXISTENT',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('caps mentions at 50 and only emits MentionCreatedEvent for the first 50', async () => {
      const manyIds = Array.from({ length: 60 }, (_, i) => `user-${i}`);
      mockMentionParser.parse.mockReturnValue({ userIds: manyIds });

      const saved = makeComment();
      mockRepo.create.mockReturnValueOnce(saved);
      mockRepo.save.mockResolvedValueOnce(saved);

      await service.create({
        workspaceId: 'W1',
        contextType: CommentContext.TASK,
        contextId: 'T1',
        authorUserId: 'U1',
        body: 'Mentions everywhere',
      });

      // 1 CommentCreatedEvent + 50 MentionCreatedEvents (not 60)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(51);
    });

    it('emits only one CommentCreatedEvent when no mentions', async () => {
      mockMentionParser.parse.mockReturnValue({ userIds: [] });
      const saved = makeComment();
      mockRepo.create.mockReturnValueOnce(saved);
      mockRepo.save.mockResolvedValueOnce(saved);

      await service.create({
        workspaceId: 'W1',
        contextType: CommentContext.TASK,
        contextId: 'T1',
        authorUserId: 'U1',
        body: 'No mentions here',
      });

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  // ── list() ────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns paginated comments for a context', async () => {
      const items = [makeComment(), makeComment({ id: 'C2' })];
      mockRepo.findAndCount.mockResolvedValueOnce([items, 2]);

      const result = await service.list({
        workspaceId: 'W1',
        contextType: CommentContext.TASK,
        contextId: 'T1',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('returns empty page when no comments exist', async () => {
      mockRepo.findAndCount.mockResolvedValueOnce([[], 0]);

      const result = await service.list({
        workspaceId: 'W1',
        contextType: CommentContext.TASK,
        contextId: 'EMPTY',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns comment when found in workspace', async () => {
      const c = makeComment();
      mockRepo.findOne.mockResolvedValueOnce(c);

      const result = await service.findOne('C1', 'W1');
      expect(result.id).toBe('C1');
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('NOPE', 'W1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── update() ──────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('allows author to update within 7-day window', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const c = makeComment({ createdAt: recentDate });
      mockRepo.findOne.mockResolvedValueOnce(c);
      const updated = makeComment({
        body: 'Updated body',
        createdAt: recentDate,
      });
      mockRepo.save.mockResolvedValueOnce(updated);

      mockMentionParser.parse
        .mockReturnValueOnce({ userIds: [] }) // new body parse
        .mockReturnValueOnce({ userIds: [] }); // old body parse

      const result = await service.update({
        id: 'C1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.MEMBER,
        newBody: 'Updated body',
      });

      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1); // CommentUpdatedEvent
      expect(result.body).toBe('Updated body');
    });

    it('throws ForbiddenException(EDIT_WINDOW_EXPIRED) after 7 days', async () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const c = makeComment({ createdAt: oldDate });
      mockRepo.findOne.mockResolvedValueOnce(c);

      await expect(
        service.update({
          id: 'C1',
          workspaceId: 'W1',
          actorUserId: 'U1',
          actorRole: WorkspaceRole.MEMBER,
          newBody: 'Late edit',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a non-author member tries to edit', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const c = makeComment({
        authorUserId: 'U_AUTHOR',
        createdAt: recentDate,
      });
      mockRepo.findOne.mockResolvedValueOnce(c);

      await expect(
        service.update({
          id: 'C1',
          workspaceId: 'W1',
          actorUserId: 'U_OTHER',
          actorRole: WorkspaceRole.MEMBER,
          newBody: 'Unauthorized edit',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('emits MentionCreatedEvent only for NEW mentions on update (mention diff)', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const oldBody = 'Hello @[Alice](00000000-0000-4000-8000-000000000001)';
      const newBody =
        'Hello @[Alice](00000000-0000-4000-8000-000000000001) and @[Bob](00000000-0000-4000-8000-000000000002)';
      const c = makeComment({ body: oldBody, createdAt: recentDate });
      mockRepo.findOne.mockResolvedValueOnce(c);
      const updated = makeComment({ body: newBody, createdAt: recentDate });
      mockRepo.save.mockResolvedValueOnce(updated);

      // new body mentions: Alice + Bob
      mockMentionParser.parse
        .mockReturnValueOnce({
          userIds: [
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
          ],
        })
        // old body mentions: Alice only
        .mockReturnValueOnce({
          userIds: ['00000000-0000-4000-8000-000000000001'],
        });

      await service.update({
        id: 'C1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.MEMBER,
        newBody,
      });

      // CommentUpdatedEvent + 1 MentionCreatedEvent for Bob only (Alice was already mentioned)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    });

    it('emits no MentionCreatedEvents when update removes mentions (no new ones)', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const c = makeComment({
        body: 'Hello @[Alice](00000000-0000-4000-8000-000000000001)',
        createdAt: recentDate,
      });
      mockRepo.findOne.mockResolvedValueOnce(c);
      const updated = makeComment({
        body: 'Hello Alice',
        createdAt: recentDate,
      });
      mockRepo.save.mockResolvedValueOnce(updated);

      // new body: no mentions; old body: Alice
      mockMentionParser.parse
        .mockReturnValueOnce({ userIds: [] })
        .mockReturnValueOnce({
          userIds: ['00000000-0000-4000-8000-000000000001'],
        });

      await service.update({
        id: 'C1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.MEMBER,
        newBody: 'Hello Alice',
      });

      // Only CommentUpdatedEvent — no new mentions
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  // ── remove() ──────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('allows the author to delete their comment', async () => {
      const c = makeComment({ authorUserId: 'U1' });
      mockRepo.findOne.mockResolvedValueOnce(c);
      mockRepo.softDelete.mockResolvedValueOnce(undefined);

      await expect(
        service.remove({
          id: 'C1',
          workspaceId: 'W1',
          actorUserId: 'U1',
          actorRole: WorkspaceRole.MEMBER,
        }),
      ).resolves.toBeUndefined();

      expect(mockRepo.softDelete).toHaveBeenCalledWith('C1');
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('allows ADMIN to delete another user comment', async () => {
      const c = makeComment({ authorUserId: 'U_OTHER' });
      mockRepo.findOne.mockResolvedValueOnce(c);
      mockRepo.softDelete.mockResolvedValueOnce(undefined);

      await expect(
        service.remove({
          id: 'C1',
          workspaceId: 'W1',
          actorUserId: 'U_ADMIN',
          actorRole: WorkspaceRole.ADMIN,
        }),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when non-author member tries to delete', async () => {
      const c = makeComment({ authorUserId: 'U_OTHER' });
      mockRepo.findOne.mockResolvedValueOnce(c);

      await expect(
        service.remove({
          id: 'C1',
          workspaceId: 'W1',
          actorUserId: 'U1',
          actorRole: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when comment does not exist', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.remove({
          id: 'NOPE',
          workspaceId: 'W1',
          actorUserId: 'U1',
          actorRole: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
