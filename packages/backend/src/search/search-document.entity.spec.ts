import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { SearchDocument } from './search-document.entity';

describe('SearchDocument entity', () => {
  it('is mapped to the search_documents table', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === SearchDocument);
    expect(tableMeta?.name).toBe('search_documents');
  });

  it('has a GIN-compatible partial unique index uq_sd_ws_type_entity', () => {
    const storage = getMetadataArgsStorage();
    const indexes = storage.indices.filter((i) => i.target === SearchDocument);
    const idx = indexes.find((i) => i.name === 'uq_sd_ws_type_entity');
    expect(idx).toBeDefined();
    expect(idx?.unique).toBe(true);
    expect(idx?.columns).toContain('workspaceId');
    expect(idx?.columns).toContain('entityType');
    expect(idx?.columns).toContain('entityId');
  });

  it('boost column defaults to 1.0', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter((c) => c.target === SearchDocument);
    const boost = columns.find((c) => c.propertyName === 'boost');
    expect(boost?.options?.default).toBe(1.0);
  });
});
