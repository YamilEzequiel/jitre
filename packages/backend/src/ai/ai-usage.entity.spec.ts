import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { AiUsageRecord } from './ai-usage.entity';

describe('AiUsageRecord entity', () => {
  it('is decorated with @Entity ai_usage_records', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === AiUsageRecord);
    expect(tableMeta).toBeDefined();
    expect(tableMeta!.name).toBe('ai_usage_records');
  });

  it('has userId column', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    expect(cols.some((c) => c.propertyName === 'userId')).toBe(true);
  });

  it('has provider column', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    expect(cols.some((c) => c.propertyName === 'provider')).toBe(true);
  });

  it('has model column', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    expect(cols.some((c) => c.propertyName === 'model')).toBe(true);
  });

  it('has operation column', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    expect(cols.some((c) => c.propertyName === 'operation')).toBe(true);
  });

  it('has promptTokens column with default 0', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    const col = cols.find((c) => c.propertyName === 'promptTokens');
    expect(col).toBeDefined();
    expect((col!.options as { default?: number }).default).toBe(0);
  });

  it('has completionTokens column with default 0', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    const col = cols.find((c) => c.propertyName === 'completionTokens');
    expect(col).toBeDefined();
    expect((col!.options as { default?: number }).default).toBe(0);
  });

  it('has totalTokens column (stored, not generated)', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    const col = cols.find((c) => c.propertyName === 'totalTokens');
    expect(col).toBeDefined();
  });

  it('has costUsd column with decimal type', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    const col = cols.find((c) => c.propertyName === 'costUsd');
    expect(col).toBeDefined();
    expect((col!.options as { type?: string }).type).toBe('decimal');
  });

  it('has latencyMs column with default 0', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    const col = cols.find((c) => c.propertyName === 'latencyMs');
    expect(col).toBeDefined();
    expect((col!.options as { default?: number }).default).toBe(0);
  });

  it('has success column with default true', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    const col = cols.find((c) => c.propertyName === 'success');
    expect(col).toBeDefined();
    expect((col!.options as { default?: boolean }).default).toBe(true);
  });

  it('has errorCode column (nullable)', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === AiUsageRecord);
    const col = cols.find((c) => c.propertyName === 'errorCode');
    expect(col).toBeDefined();
    expect((col!.options as { nullable?: boolean }).nullable).toBe(true);
  });

  it('has at least 11 own columns (userId through errorCode)', () => {
    const storage = getMetadataArgsStorage();
    const ownCols = storage.columns.filter((c) => c.target === AiUsageRecord);
    expect(ownCols.length).toBeGreaterThanOrEqual(11);
  });
});
