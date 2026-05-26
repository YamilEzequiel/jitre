import { Test } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { STORAGE_DRIVER } from '../storage/storage.constants';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import * as signedUrlUtil from '../storage/signed-url.util';

const mockDriver = {
  name: 'local',
  get: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, def?: unknown) => {
    const map: Record<string, unknown> = {
      'storage.localSigningSecret': 'test-secret',
    };
    return map[key] ?? def;
  }),
};

function makeResponse(): jest.Mocked<Partial<Response>> {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };
}

describe('FilesController', () => {
  let controller: FilesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: STORAGE_DRIVER, useValue: mockDriver },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    controller = module.get(FilesController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  describe('serveFile()', () => {
    it('rejects requests with invalid/missing token', async () => {
      const res = makeResponse() as unknown as Response;
      await expect(
        controller.serveFile(
          'workspaces/W1/test/file.txt',
          'invalid-token',
          '9999999999',
          res,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('streams file when token is valid', async () => {
      const key = 'workspaces/W1/task/T1/A1-test.txt';
      const { token, expiresAt } = signedUrlUtil.signKey(
        key,
        300,
        'test-secret',
      );

      const mockStream = { pipe: jest.fn() };
      mockDriver.get.mockResolvedValueOnce({
        stream: mockStream,
        sizeBytes: 100,
        contentType: 'text/plain',
      });

      const res = makeResponse() as unknown as Response;
      await controller.serveFile(key, token, String(expiresAt), res);

      expect(mockDriver.get).toHaveBeenCalledWith(key);
    });
  });
});
