import { Test } from '@nestjs/testing';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { AttachmentContext, WorkspaceRole } from '@jitre/shared';
import { NotFoundException } from '@nestjs/common';

const mockService = {
  upload: jest.fn(),
  findByIdScoped: jest.fn(),
  softDelete: jest.fn(),
  download: jest.fn(),
};

function makeRequest(overrides = {}): unknown {
  return {
    user: { id: 'U1' },
    workspace: { id: 'W1', role: WorkspaceRole.MEMBER },
    ...overrides,
  };
}

describe('AttachmentController', () => {
  let controller: AttachmentController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AttachmentController],
      providers: [{ provide: AttachmentService, useValue: mockService }],
    }).compile();
    controller = module.get(AttachmentController);
  });

  describe('upload()', () => {
    it('calls service.upload and returns attachment', async () => {
      const file = {
        buffer: Buffer.from('x'),
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 10,
      } as Express.Multer.File;
      const dto = { context: AttachmentContext.TASK, contextId: 'T1' };
      mockService.upload.mockResolvedValueOnce({ id: 'A1' });

      const result = await controller.upload(
        file,
        dto,
        makeRequest() as Parameters<typeof controller.upload>[2],
      );

      expect(mockService.upload).toHaveBeenCalled();
      expect(result).toEqual({ id: 'A1' });
    });
  });

  describe('findOne()', () => {
    it('returns attachment for valid scope', async () => {
      mockService.findByIdScoped.mockResolvedValueOnce({ id: 'A1' });
      const result = await controller.findOne(
        'A1',
        makeRequest() as Parameters<typeof controller.findOne>[1],
      );
      expect(result.id).toBe('A1');
    });

    it('throws NotFoundException when not found', async () => {
      mockService.findByIdScoped.mockRejectedValueOnce(new NotFoundException());
      await expect(
        controller.findOne(
          'A1',
          makeRequest() as Parameters<typeof controller.findOne>[1],
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('calls softDelete with actor info', async () => {
      mockService.softDelete.mockResolvedValueOnce(undefined);
      await controller.remove(
        'A1',
        makeRequest() as Parameters<typeof controller.remove>[1],
      );
      expect(mockService.softDelete).toHaveBeenCalledWith(
        'A1',
        'U1',
        WorkspaceRole.MEMBER,
        'W1',
      );
    });
  });

  describe('download()', () => {
    it('returns download result', async () => {
      mockService.download.mockResolvedValueOnce({
        signedUrl: 'http://x',
        attachment: { id: 'A1' },
        driver: 'local',
      });
      const result = await controller.download(
        'A1',
        makeRequest() as Parameters<typeof controller.download>[1],
      );
      expect(result.signedUrl).toBe('http://x');
    });
  });
});
