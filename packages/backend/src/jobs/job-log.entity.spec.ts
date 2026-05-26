import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { JobLog } from './job-log.entity';

describe('JobLog entity', () => {
  it('is mapped to the job_logs table', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === JobLog);
    expect(tableMeta?.name).toBe('job_logs');
  });

  it('has a unique constraint on jobId', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter((c) => c.target === JobLog);
    const jobIdCol = columns.find((c) => c.propertyName === 'jobId');
    expect(jobIdCol?.options?.unique).toBe(true);
  });

  it('errorMessage column is nullable', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter((c) => c.target === JobLog);
    const col = columns.find((c) => c.propertyName === 'errorMessage');
    expect(col?.options?.nullable).toBe(true);
  });

  it('durationMs column is nullable', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter((c) => c.target === JobLog);
    const col = columns.find((c) => c.propertyName === 'durationMs');
    expect(col?.options?.nullable).toBe(true);
  });

  it('has a composite index idx_jl_queue_status_time', () => {
    const storage = getMetadataArgsStorage();
    const indexes = storage.indices.filter((i) => i.target === JobLog);
    const idx = indexes.find((i) => i.name === 'idx_jl_queue_status_time');
    expect(idx).toBeDefined();
    expect(idx?.columns).toEqual(['queueName', 'status', 'createdAt']);
  });
});
