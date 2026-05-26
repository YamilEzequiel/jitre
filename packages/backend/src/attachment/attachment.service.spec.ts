import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentService } from './attachment.service';
import { Attachment } from './attachment.entity';
import { AttachmentContext, WorkspaceRole } from '@jitre/shared';
import { STORAGE_DRIVER } from '../storage/storage.constants';
import { EventBusService } from '../events/event-bus.service';
import * as mimeValidator from './mime-validator.util';

function makePngBuffer(): Buffer {
  const buf = Buffer.alloc(100, 0);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  buf[8] = 0;
  buf[9] = 0;
  buf[10] = 0;
  buf[11] = 13;
  buf[12] = 0x49;
  buf[13] = 0x48;
  buf[14] = 0x44;
  buf[15] = 0x52;
  return buf;
}

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  softDelete: jest.fn(),
};

const mockDriver = {
  name: 'local',
  put: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  getSignedUrl: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, def?: unknown) => {
    const map: Record<string, unknown> = {
      'storage.maxFileSizeBytes': 25 * 1024 * 1024,
      'storage.localSigningSecret': 'test-secret',
    };
    return map[key] ?? def;
  }),
};

describe('AttachmentService', () => {
  let service: AttachmentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AttachmentService,
        { provide: getRepositoryToken(Attachment), useValue: mockRepo },
        { provide: STORAGE_DRIVER, useValue: mockDriver },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AttachmentService);
  });

  describe('upload()', () => {
    const validInput = {
      file: {
        buffer: makePngBuffer(),
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 100,
      },
      context: AttachmentContext.TASK,
      contextId: 'T1',
      uploaderUserId: 'U1',
      workspaceId: 'W1',
    };

    it('rejects files exceeding max size', async () => {
      await expect(
        service.upload({
          ...validInput,
          file: { ...validInput.file, size: 30 * 1024 * 1024 },
        }),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('rejects invalid MIME type', async () => {
      jest
        .spyOn(mimeValidator, 'validateAttachmentMime')
        .mockResolvedValueOnce({
          valid: false,
          reason: 'bad mime',
        });
      await expect(service.upload(validInput)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('calls driver.put and saves attachment on valid upload', async () => {
      jest
        .spyOn(mimeValidator, 'validateAttachmentMime')
        .mockResolvedValueOnce({ valid: true });
      mockDriver.put.mockResolvedValueOnce({
        key: 'test/key',
        sizeBytes: 100,
        checksum: 'abc',
      });
      const saved = { id: 'A1', ...validInput };
      mockRepo.create.mockReturnValueOnce(saved);
      mockRepo.save.mockResolvedValueOnce(saved);

      const result = await service.upload(validInput);

      expect(mockDriver.put).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('attempts driver cleanup if save fails', async () => {
      jest
        .spyOn(mimeValidator, 'validateAttachmentMime')
        .mockResolvedValueOnce({ valid: true });
      mockDriver.put.mockResolvedValueOnce({ key: 'test/key', sizeBytes: 100 });
      mockDriver.delete.mockResolvedValueOnce(undefined);
      mockRepo.create.mockReturnValueOnce({});
      mockRepo.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.upload(validInput)).rejects.toThrow('DB error');
      expect(mockDriver.delete).toHaveBeenCalled();
    });
  });

  describe('findByIdScoped()', () => {
    it('returns attachment when found in workspace', async () => {
      const att = { id: 'A1', workspaceId: 'W1' };
      mockRepo.findOne.mockResolvedValueOnce(att);
      const result = await service.findByIdScoped('A1', 'W1');
      expect(result.id).toBe('A1');
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findByIdScoped('A1', 'W1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('download()', () => {
    it('returns signedUrl from driver', async () => {
      const att = { id: 'A1', workspaceId: 'W1', storageKey: 'test/key' };
      mockRepo.findOne.mockResolvedValueOnce(att);
      mockDriver.getSignedUrl.mockResolvedValueOnce('http://signed.url');

      const result = await service.download('A1', 'W1');
      expect(result.signedUrl).toBe('http://signed.url');
      expect(result.attachment).toBe(att);
    });
  });

  describe('softDelete()', () => {
    it('allows owner to delete their own attachment', async () => {
      const att = { id: 'A1', workspaceId: 'W1', uploadedByUserId: 'U1' };
      mockRepo.findOne.mockResolvedValueOnce(att);
      mockRepo.softDelete.mockResolvedValueOnce(undefined);

      await expect(
        service.softDelete('A1', 'U1', WorkspaceRole.MEMBER, 'W1'),
      ).resolves.toBeUndefined();
    });

    it('allows admin to delete another user attachment', async () => {
      const att = { id: 'A1', workspaceId: 'W1', uploadedByUserId: 'U2' };
      mockRepo.findOne.mockResolvedValueOnce(att);
      mockRepo.softDelete.mockResolvedValueOnce(undefined);

      await expect(
        service.softDelete('A1', 'U1', WorkspaceRole.ADMIN, 'W1'),
      ).resolves.toBeUndefined();
    });

    it('throws Forbidden when member tries to delete another user attachment', async () => {
      const att = { id: 'A1', workspaceId: 'W1', uploadedByUserId: 'U2' };
      mockRepo.findOne.mockResolvedValueOnce(att);

      await expect(
        service.softDelete('A1', 'U1', WorkspaceRole.MEMBER, 'W1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
