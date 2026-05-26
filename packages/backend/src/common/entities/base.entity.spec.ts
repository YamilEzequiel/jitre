import { BaseEntity } from './base.entity';
import { TenantEntity } from './tenant.entity';
import { getMetadataArgsStorage } from 'typeorm';

describe('BaseEntity contract', () => {
  it('declares the seven audit columns on subclasses', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns
      .filter((c) => c.target === BaseEntity)
      .map((c) => c.propertyName);

    // PrimaryGeneratedColumn, version, soft-delete and audit timestamps emit
    // separate metadata entries — assert each is registered.
    expect(cols).toEqual(
      expect.arrayContaining([
        'createdAt',
        'updatedAt',
        'deletedAt',
        'createdBy',
        'updatedBy',
        'version',
      ]),
    );

    const pk = storage.columns.find(
      (c) => c.target === BaseEntity && c.options.primary === true,
    );
    expect(pk?.propertyName).toBe('id');
  });

  it('TenantEntity adds workspaceId on top of BaseEntity columns', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns
      .filter((c) => c.target === TenantEntity)
      .map((c) => c.propertyName);
    expect(cols).toContain('workspaceId');
  });
});
