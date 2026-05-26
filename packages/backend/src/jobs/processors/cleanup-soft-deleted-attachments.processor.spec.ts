import { CleanupSoftDeletedAttachmentsProcessor } from './cleanup-soft-deleted-attachments.processor';

const makeJob = () =>
  ({
    data: {},
    attemptsMade: 0,
    id: 'job-1',
  }) as unknown as import('bullmq').Job;

describe('CleanupSoftDeletedAttachmentsProcessor', () => {
  let processor: CleanupSoftDeletedAttachmentsProcessor;
  let attachmentRepo: { find: jest.Mock; delete: jest.Mock };
  let storageDriver: { delete: jest.Mock };

  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    attachmentRepo = {
      find: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    storageDriver = { delete: jest.fn().mockResolvedValue(undefined) };
    processor = new CleanupSoftDeletedAttachmentsProcessor(
      attachmentRepo as never,
      storageDriver as never,
    );
  });

  it('hard-deletes only rows older than 30 days', async () => {
    attachmentRepo.find.mockResolvedValue([
      { id: 'A2', storageKey: 'key2', deletedAt: fortyDaysAgo },
    ]);

    const result = await processor.process(makeJob());

    expect(storageDriver.delete).toHaveBeenCalledWith('key2');
    expect(attachmentRepo.delete).toHaveBeenCalledWith('A2');
    expect(result).toEqual({
      deletedCount: 1,
      missingFileCount: 0,
      errorCount: 0,
    });
  });

  it('does not delete rows deleted less than 30 days ago', async () => {
    attachmentRepo.find.mockResolvedValue([]);

    const result = await processor.process(makeJob());

    expect(storageDriver.delete).not.toHaveBeenCalled();
    expect(result).toEqual({
      deletedCount: 0,
      missingFileCount: 0,
      errorCount: 0,
    });
  });

  it('tolerates NotFoundError from storage driver and still hard-deletes the row', async () => {
    attachmentRepo.find.mockResolvedValue([
      { id: 'A2', storageKey: 'missing-key', deletedAt: fortyDaysAgo },
    ]);
    const notFound = new Error('NotFound');
    (notFound as Record<string, unknown>).code = 'NOT_FOUND';
    storageDriver.delete.mockRejectedValue(notFound);

    const result = await processor.process(makeJob());

    expect(attachmentRepo.delete).toHaveBeenCalledWith('A2');
    expect(result).toEqual({
      deletedCount: 1,
      missingFileCount: 1,
      errorCount: 0,
    });
  });
});
