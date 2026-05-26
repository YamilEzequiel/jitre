import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@jitre/shared';
import { ChatService } from './chat.service';
import { ChatChannelEntity } from './chat-channel.entity';
import { ChatMembershipEntity } from './chat-membership.entity';
import { ChatMessageEntity } from './chat-message.entity';
import { EventBusService } from '../events/event-bus.service';
import { ProjectEntity } from '../project/project.entity';
import { ProjectMembershipEntity } from '../project/project-membership/project-membership.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChannel(
  overrides: Partial<ChatChannelEntity> = {},
): ChatChannelEntity {
  return {
    id: 'CH1',
    workspaceId: 'W1',
    name: 'general',
    description: null,
    type: 'public',
    kind: 'custom',
    projectId: null,
    createdByUserId: 'U1',
    lastMessageAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  } as ChatChannelEntity;
}

function makeMembership(
  overrides: Partial<ChatMembershipEntity> = {},
): ChatMembershipEntity {
  return {
    channelId: 'CH1',
    userId: 'U1',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    lastReadMessageId: null,
    notificationLevel: 'all',
    ...overrides,
  } as ChatMembershipEntity;
}

function makeMessage(
  overrides: Partial<ChatMessageEntity> = {},
): ChatMessageEntity {
  return {
    id: 'M1',
    workspaceId: 'W1',
    channelId: 'CH1',
    authorId: 'U1',
    body: 'hello',
    parentMessageId: null,
    attachments: [],
    editedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  } as ChatMessageEntity;
}

// ─── Repository mocks (reset in beforeEach to avoid mockResolvedValueOnce
//     queue leakage across tests) ─────────────────────────────────────────

let channelRepo: {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  softDelete: jest.Mock;
  createQueryBuilder: jest.Mock;
};
let membershipRepo: {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  delete: jest.Mock;
};
let messageRepo: {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  softDelete: jest.Mock;
  count: jest.Mock;
  createQueryBuilder: jest.Mock;
};
let projectRepo: {
  findOne: jest.Mock;
};
let projectMembershipRepo: {
  find: jest.Mock;
};
let eventBus: { publish: jest.Mock };

function makeQueryBuilder(returnValue: unknown): {
  leftJoin: jest.Mock;
  innerJoin: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  limit: jest.Mock;
  getMany: jest.Mock;
  getCount: jest.Mock;
} {
  const qb = {
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(returnValue),
    getCount: jest
      .fn()
      .mockResolvedValue(Array.isArray(returnValue) ? returnValue.length : 0),
  };
  return qb;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();
    channelRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    membershipRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };
    messageRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      softDelete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    projectRepo = {
      findOne: jest.fn(),
    };
    projectMembershipRepo = {
      find: jest.fn(),
    };
    eventBus = { publish: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ChatChannelEntity), useValue: channelRepo },
        {
          provide: getRepositoryToken(ChatMembershipEntity),
          useValue: membershipRepo,
        },
        { provide: getRepositoryToken(ChatMessageEntity), useValue: messageRepo },
        { provide: getRepositoryToken(ProjectEntity), useValue: projectRepo },
        { provide: getRepositoryToken(ProjectMembershipEntity), useValue: projectMembershipRepo },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  // ── createChannel ─────────────────────────────────────────────────────────

  describe('createChannel()', () => {
    it('creates a channel and adds the creator + provided members', async () => {
      const created = makeChannel({ name: 'random', type: 'public' });
      channelRepo.create.mockReturnValueOnce(created);
      channelRepo.save.mockResolvedValueOnce(created);
      membershipRepo.create.mockImplementation((m) => m);
      membershipRepo.save.mockResolvedValueOnce([]);

      const result = await service.createChannel('W1', 'U1', {
        name: 'random',
        type: 'public',
        memberUserIds: ['U2', 'U3'],
      });

      expect(result).toEqual(created);
      // Creator + 2 members deduped
      const savedMembers = membershipRepo.save.mock.calls[0]![0] as Array<{
        userId: string;
      }>;
      expect(savedMembers.map((m) => m.userId).sort()).toEqual([
        'U1',
        'U2',
        'U3',
      ]);
    });

    it('dedupes creator when included in memberUserIds', async () => {
      const created = makeChannel();
      channelRepo.create.mockReturnValueOnce(created);
      channelRepo.save.mockResolvedValueOnce(created);
      membershipRepo.create.mockImplementation((m) => m);
      membershipRepo.save.mockResolvedValueOnce([]);

      await service.createChannel('W1', 'U1', {
        name: 'random',
        type: 'public',
        memberUserIds: ['U1', 'U2'],
      });

      const savedMembers = membershipRepo.save.mock.calls[0]![0] as Array<{
        userId: string;
      }>;
      expect(savedMembers).toHaveLength(2);
    });
  });

  // ── createOrGetDm ─────────────────────────────────────────────────────────

  describe('createOrGetDm()', () => {
    it('throws BadRequestException when DMing self', async () => {
      await expect(service.createOrGetDm('W1', 'U1', 'U1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns existing DM if found', async () => {
      const existing = makeChannel({ type: 'dm', name: 'dm:A:B' });
      channelRepo.findOne.mockResolvedValueOnce(existing);

      const result = await service.createOrGetDm('W1', 'B', 'A');
      expect(result).toEqual(existing);
      expect(channelRepo.findOne).toHaveBeenCalledWith({
        where: { workspaceId: 'W1', name: 'dm:A:B', type: 'dm' },
      });
    });

    it('creates a new DM with sorted UUID name when none exists', async () => {
      channelRepo.findOne.mockResolvedValueOnce(null);
      const created = makeChannel({ type: 'dm', name: 'dm:A:B' });
      channelRepo.create.mockReturnValueOnce(created);
      channelRepo.save.mockResolvedValueOnce(created);
      membershipRepo.create.mockImplementation((m) => m);
      membershipRepo.save.mockResolvedValueOnce([]);

      const result = await service.createOrGetDm('W1', 'B', 'A');
      expect(result).toEqual(created);
      // creator UUID 'A' < 'B' so name should be dm:A:B
      const arg = channelRepo.create.mock.calls[0]![0] as { name: string };
      expect(arg.name).toBe('dm:A:B');
    });

    it('builds the same DM name regardless of caller order', async () => {
      channelRepo.findOne.mockResolvedValueOnce(null);
      const created = makeChannel({ type: 'dm', name: 'dm:A:B' });
      channelRepo.create.mockReturnValueOnce(created);
      channelRepo.save.mockResolvedValueOnce(created);
      membershipRepo.create.mockImplementation((m) => m);
      membershipRepo.save.mockResolvedValueOnce([]);

      await service.createOrGetDm('W1', 'A', 'B');
      const arg = channelRepo.create.mock.calls[0]![0] as { name: string };
      expect(arg.name).toBe('dm:A:B');
    });
  });

  describe('ensureGeneralChannel()', () => {
    it('creates a workspace general channel once and reuses it', async () => {
      const existing = makeChannel({ id: 'CH-GENERAL', name: 'general', kind: 'general' });
      channelRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
      channelRepo.create.mockReturnValueOnce(existing);
      channelRepo.save.mockResolvedValueOnce(existing);
      membershipRepo.create.mockImplementation((m) => m);
      membershipRepo.save.mockResolvedValueOnce([]);

      const first = await (service as any).ensureGeneralChannel('W1', 'U1');
      const second = await (service as any).ensureGeneralChannel('W1', 'U1');

      expect(first.id).toBe('CH-GENERAL');
      expect((first as any).kind).toBe('general');
      expect(second.id).toBe(first.id);
      expect(channelRepo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureProjectChannel()', () => {
    it('creates a project channel linked to the project and seeds memberships', async () => {
      const created = makeChannel({
        id: 'CH-PROJ',
        name: 'platform',
        kind: 'project',
        projectId: 'P1',
      });
      channelRepo.findOne.mockResolvedValueOnce(null);
      channelRepo.create.mockReturnValueOnce(created);
      channelRepo.save.mockResolvedValueOnce(created);
      membershipRepo.create.mockImplementation((m) => m);
      membershipRepo.save.mockResolvedValueOnce([]);
      membershipRepo.find.mockResolvedValueOnce([
        makeMembership({ userId: 'U1' }),
        makeMembership({ userId: 'U2' }),
      ]);

      const result = await (service as any).ensureProjectChannel({
        workspaceId: 'W1',
        projectId: 'P1',
        projectName: 'Platform',
        actorUserId: 'U1',
        memberUserIds: ['U1', 'U2'],
      });

      expect(result.id).toBe('CH-PROJ');
      expect((result as any).kind).toBe('project');
      expect((result as any).projectId).toBe('P1');

      const savedMembers = membershipRepo.save.mock.calls[0]![0] as Array<{ userId: string }>;
      expect(savedMembers.map((m) => m.userId).sort()).toEqual(['U1', 'U2']);
    });
  });

  // ── listChannels ──────────────────────────────────────────────────────────

  describe('listChannels()', () => {
    it('returns channels via query builder', async () => {
      const channels = [makeChannel(), makeChannel({ id: 'CH2' })];
      const qb = makeQueryBuilder(channels);
      channelRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.listChannels('W1', 'U1');
      expect(result).toEqual(channels);
      expect(qb.where).toHaveBeenCalled();
      expect(qb.getMany).toHaveBeenCalled();
    });
  });

  // ── getChannel ────────────────────────────────────────────────────────────

  describe('getChannel()', () => {
    it('returns the channel when found in workspace', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      const result = await service.getChannel('CH1', 'W1');
      expect(result).toEqual(c);
    });

    it('throws NotFoundException when channel not in workspace', async () => {
      channelRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getChannel('CH1', 'W1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getProjectChannel()', () => {
    it('returns the existing project channel when present', async () => {
      const channel = makeChannel({ id: 'CH-PROJ', kind: 'project', projectId: 'P1' });
      channelRepo.findOne.mockResolvedValueOnce(channel);

      await expect(service.getProjectChannel('P1', 'W1')).resolves.toEqual(channel);
    });

    it('self-heals legacy projects by creating the missing channel on demand', async () => {
      channelRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      projectRepo.findOne.mockResolvedValueOnce({
        id: 'P1',
        workspaceId: 'W1',
        name: 'Platform',
        ownerUserId: 'U1',
      });
      projectMembershipRepo.find.mockResolvedValueOnce([
        { userId: 'U1' },
        { userId: 'U2' },
      ]);
      const created = makeChannel({
        id: 'CH-PROJ',
        name: 'platform',
        kind: 'project',
        projectId: 'P1',
      });
      channelRepo.create.mockReturnValueOnce(created);
      channelRepo.save.mockResolvedValueOnce(created);
      membershipRepo.create.mockImplementation((m) => m);
      membershipRepo.save.mockResolvedValueOnce([]);

      const result = await service.getProjectChannel('P1', 'W1');

      expect(result.id).toBe('CH-PROJ');
      expect(projectRepo.findOne).toHaveBeenCalledWith({ where: { id: 'P1', workspaceId: 'W1' } });
      expect(projectMembershipRepo.find).toHaveBeenCalledWith({ where: { projectId: 'P1', workspaceId: 'W1' } });
    });
  });

  // ── updateChannel ─────────────────────────────────────────────────────────

  describe('updateChannel()', () => {
    it('updates name and description', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      channelRepo.save.mockResolvedValueOnce({
        ...c,
        name: 'renamed',
        description: 'd',
      });

      const updated = await service.updateChannel('CH1', 'W1', {
        name: 'renamed',
        description: 'd',
      });
      expect(updated.name).toBe('renamed');
      expect(updated.description).toBe('d');
    });

    it('rejects updating a DM channel', async () => {
      const c = makeChannel({ type: 'dm' });
      channelRepo.findOne.mockResolvedValueOnce(c);
      await expect(
        service.updateChannel('CH1', 'W1', { name: 'no' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── deleteChannel ─────────────────────────────────────────────────────────

  describe('deleteChannel()', () => {
    it('soft-deletes a public channel', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      channelRepo.softDelete.mockResolvedValueOnce(undefined);
      await expect(service.deleteChannel('CH1', 'W1')).resolves.toBeUndefined();
      expect(channelRepo.softDelete).toHaveBeenCalledWith('CH1');
    });

    it('rejects deleting a DM channel', async () => {
      const c = makeChannel({ type: 'dm' });
      channelRepo.findOne.mockResolvedValueOnce(c);
      await expect(service.deleteChannel('CH1', 'W1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── addMember / removeMember / isMember ──────────────────────────────────

  describe('addMember()', () => {
    it('adds a new membership', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(null);
      const m = makeMembership({ userId: 'U9' });
      membershipRepo.create.mockReturnValueOnce(m);
      membershipRepo.save.mockResolvedValueOnce(m);

      const result = await service.addMember('CH1', 'W1', 'U9');
      expect(result).toEqual(m);
    });

    it('returns existing membership when already present (idempotent)', async () => {
      const c = makeChannel();
      const m = makeMembership({ userId: 'U1' });
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(m);

      const result = await service.addMember('CH1', 'W1', 'U1');
      expect(result).toEqual(m);
      expect(membershipRepo.save).not.toHaveBeenCalled();
    });

    it('rejects adding members to a DM', async () => {
      const c = makeChannel({ type: 'dm' });
      channelRepo.findOne.mockResolvedValueOnce(c);
      await expect(service.addMember('CH1', 'W1', 'U9')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeMember()', () => {
    it('removes a membership', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.delete.mockResolvedValueOnce({ affected: 1 });

      await expect(
        service.removeMember('CH1', 'W1', 'U2'),
      ).resolves.toBeUndefined();
      expect(membershipRepo.delete).toHaveBeenCalledWith({
        channelId: 'CH1',
        userId: 'U2',
      });
    });

    it('rejects removing from a DM', async () => {
      const c = makeChannel({ type: 'dm' });
      channelRepo.findOne.mockResolvedValueOnce(c);
      await expect(service.removeMember('CH1', 'W1', 'U2')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('isMember()', () => {
    it('returns true when membership exists', async () => {
      membershipRepo.findOne.mockResolvedValueOnce(makeMembership());
      const result = await service.isMember('CH1', 'U1');
      expect(result).toBe(true);
    });

    it('returns false when membership absent', async () => {
      membershipRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.isMember('CH1', 'U1');
      expect(result).toBe(false);
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  describe('sendMessage()', () => {
    it('rejects when user is not a member of a private channel', async () => {
      const c = makeChannel({ type: 'private' });
      channelRepo.findOne.mockResolvedValueOnce(c); // getChannel
      membershipRepo.findOne.mockResolvedValueOnce(null); // isMember

      await expect(
        service.sendMessage('W1', 'U9', { channelId: 'CH1', body: 'hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('auto-joins public channel and sends, emitting ChatMessageCreatedEvent', async () => {
      const c = makeChannel({ type: 'public' });
      channelRepo.findOne
        .mockResolvedValueOnce(c) // getChannel (sendMessage)
        .mockResolvedValueOnce(c); // getChannel (addMember inside auto-join)
      membershipRepo.findOne
        .mockResolvedValueOnce(null) // initial isMember
        .mockResolvedValueOnce(null); // addMember -> existing check
      membershipRepo.create.mockImplementation((m) => m);
      membershipRepo.save.mockResolvedValueOnce(makeMembership({ userId: 'U9' }));

      const m = makeMessage({ authorId: 'U9' });
      messageRepo.create.mockReturnValueOnce(m);
      messageRepo.save.mockResolvedValueOnce(m);
      channelRepo.save.mockResolvedValueOnce({ ...c, lastMessageAt: m.createdAt });

      const result = await service.sendMessage('W1', 'U9', {
        channelId: 'CH1',
        body: 'hello',
      });

      expect(result.id).toBe('M1');
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('rejects sending with non-existent parentMessageId', async () => {
      const c = makeChannel({ type: 'public' });
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(makeMembership()); // is member
      messageRepo.findOne.mockResolvedValueOnce(null); // parent lookup

      await expect(
        service.sendMessage('W1', 'U1', {
          channelId: 'CH1',
          body: 'reply',
          parentMessageId: 'GHOST',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('persists attachments and updates channel.lastMessageAt', async () => {
      const c = makeChannel({ type: 'public' });
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(makeMembership());
      const attachments = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          url: 'https://x/y',
          name: 'file.png',
          size: 100,
          mimeType: 'image/png',
        },
      ];
      const m = makeMessage({ attachments });
      messageRepo.create.mockReturnValueOnce(m);
      messageRepo.save.mockResolvedValueOnce(m);
      channelRepo.save.mockResolvedValueOnce(c);

      await service.sendMessage('W1', 'U1', {
        channelId: 'CH1',
        body: 'with file',
        attachments,
      });

      expect(channelRepo.save).toHaveBeenCalled();
      const updated = channelRepo.save.mock.calls.at(-1)![0] as ChatChannelEntity;
      expect(updated.lastMessageAt).toEqual(m.createdAt);
    });
  });

  // ── editMessage ───────────────────────────────────────────────────────────

  describe('editMessage()', () => {
    it('rejects when actor is not the author', async () => {
      const m = makeMessage({ authorId: 'U_OWNER' });
      messageRepo.findOne.mockResolvedValueOnce(m);
      await expect(
        service.editMessage('M1', 'W1', 'U_OTHER', { body: 'nope' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates body, sets editedAt, and emits ChatMessageEditedEvent', async () => {
      const m = makeMessage();
      messageRepo.findOne.mockResolvedValueOnce(m);
      const edited = makeMessage({ body: 'new', editedAt: new Date() });
      messageRepo.save.mockResolvedValueOnce(edited);

      const result = await service.editMessage('M1', 'W1', 'U1', {
        body: 'new',
      });
      expect(result.body).toBe('new');
      expect(result.editedAt).not.toBeNull();
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  // ── deleteMessage ─────────────────────────────────────────────────────────

  describe('deleteMessage()', () => {
    it('allows author to delete', async () => {
      const m = makeMessage({ authorId: 'U1' });
      messageRepo.findOne.mockResolvedValueOnce(m);
      messageRepo.softDelete.mockResolvedValueOnce(undefined);

      await expect(
        service.deleteMessage('M1', 'W1', 'U1', WorkspaceRole.MEMBER),
      ).resolves.toBeUndefined();
      expect(messageRepo.softDelete).toHaveBeenCalledWith('M1');
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('allows ADMIN to delete another author message', async () => {
      const m = makeMessage({ authorId: 'U_OTHER' });
      messageRepo.findOne.mockResolvedValueOnce(m);
      messageRepo.softDelete.mockResolvedValueOnce(undefined);

      await expect(
        service.deleteMessage('M1', 'W1', 'U_ADMIN', WorkspaceRole.ADMIN),
      ).resolves.toBeUndefined();
    });

    it('rejects non-author member', async () => {
      const m = makeMessage({ authorId: 'U_OTHER' });
      messageRepo.findOne.mockResolvedValueOnce(m);
      await expect(
        service.deleteMessage('M1', 'W1', 'U1', WorkspaceRole.MEMBER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── listMessages ──────────────────────────────────────────────────────────

  describe('listMessages()', () => {
    it('returns messages DESC and computes hasMore/nextCursor', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      // simulate hasMore: take=limit+1 returns 3 when limit is 2
      const m1 = makeMessage({ id: 'M-a' });
      const m2 = makeMessage({ id: 'M-b' });
      const m3 = makeMessage({ id: 'M-c' });
      messageRepo.find.mockResolvedValueOnce([m1, m2, m3]);

      const result = await service.listMessages('CH1', 'W1', { limit: 2 });
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('M-b');
    });

    it('returns hasMore=false when result fits in limit', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      const m1 = makeMessage({ id: 'M-x' });
      messageRepo.find.mockResolvedValueOnce([m1]);

      const result = await service.listMessages('CH1', 'W1', { limit: 50 });
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBe(null);
    });

    it('uses before cursor to filter older messages', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      const cursor = makeMessage({
        id: 'CURSOR',
        createdAt: new Date('2026-02-01T00:00:00Z'),
      });
      messageRepo.findOne.mockResolvedValueOnce(cursor);
      messageRepo.find.mockResolvedValueOnce([]);

      await service.listMessages('CH1', 'W1', { before: 'CURSOR', limit: 10 });
      const findArg = messageRepo.find.mock.calls.at(-1)![0] as {
        where: { createdAt?: unknown };
      };
      expect(findArg.where.createdAt).toBeDefined();
    });
  });

  // ── markAsRead / unread ───────────────────────────────────────────────────

  describe('markAsRead()', () => {
    it('updates lastReadMessageId on membership', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      const mem = makeMembership({ lastReadMessageId: null });
      membershipRepo.findOne.mockResolvedValueOnce(mem);
      messageRepo.findOne.mockResolvedValueOnce(makeMessage({ id: 'M1' }));
      membershipRepo.save.mockResolvedValueOnce({
        ...mem,
        lastReadMessageId: 'M1',
      });

      const result = await service.markAsRead('CH1', 'W1', 'U1', 'M1');
      expect(result.lastReadMessageId).toBe('M1');
    });

    it('rejects when user is not a member', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.markAsRead('CH1', 'W1', 'U1', 'M1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when message not in channel', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(makeMembership());
      messageRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.markAsRead('CH1', 'W1', 'U1', 'GHOST'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount()', () => {
    it('returns 0 when user is not a member', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.getUnreadCount('CH1', 'W1', 'U_X');
      expect(result).toBe(0);
    });

    it('returns total channel messages when membership has no lastReadMessageId', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(
        makeMembership({ lastReadMessageId: null }),
      );
      messageRepo.count.mockResolvedValueOnce(7);
      const result = await service.getUnreadCount('CH1', 'W1', 'U1');
      expect(result).toBe(7);
    });

    it('returns count of messages newer than lastRead', async () => {
      const c = makeChannel();
      channelRepo.findOne.mockResolvedValueOnce(c);
      membershipRepo.findOne.mockResolvedValueOnce(
        makeMembership({ lastReadMessageId: 'M_LAST' }),
      );
      messageRepo.findOne.mockResolvedValueOnce(
        makeMessage({ id: 'M_LAST', createdAt: new Date('2026-01-15') }),
      );
      const qb = makeQueryBuilder([]);
      qb.getCount.mockResolvedValueOnce(3);
      messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.getUnreadCount('CH1', 'W1', 'U1');
      expect(result).toBe(3);
    });
  });

  // ── searchMessages ────────────────────────────────────────────────────────

  describe('searchMessages()', () => {
    it('returns [] for blank query', async () => {
      const result = await service.searchMessages('W1', 'U1', '   ');
      expect(result).toEqual([]);
    });

    it('runs ILIKE filter via query builder', async () => {
      const msgs = [makeMessage({ body: 'hello world' })];
      const qb = makeQueryBuilder(msgs);
      messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.searchMessages('W1', 'U1', 'hello');
      expect(result).toEqual(msgs);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ pattern: '%hello%' }),
      );
    });
  });
});
