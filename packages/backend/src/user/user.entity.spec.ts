import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { UserEntity } from './user.entity';
import { BaseEntity } from '../common/entities/base.entity';

function allColumns(target: Function) {
  const storage = getMetadataArgsStorage();
  const cols = storage.columns.filter((c) => c.target === target);
  return cols;
}

describe('UserEntity', () => {
  it('is decorated with @Entity("users")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === UserEntity);
    expect(table?.name).toBe('users');
  });

  it('has email column of type citext', () => {
    const col = allColumns(UserEntity).find((c) => c.propertyName === 'email');
    expect(col).toBeDefined();
    expect(col?.options.type).toBe('citext');
  });

  it('has passwordHash column', () => {
    const col = allColumns(UserEntity).find(
      (c) => c.propertyName === 'passwordHash',
    );
    expect(col).toBeDefined();
  });

  it('excludes passwordHash from JSON serialization via toJSON', () => {
    const instance = new UserEntity();
    instance.passwordHash = 'secret-hash';
    const json = JSON.parse(JSON.stringify(instance));
    expect(json.passwordHash).toBeUndefined();
  });

  it('has displayName column', () => {
    const col = allColumns(UserEntity).find(
      (c) => c.propertyName === 'displayName',
    );
    expect(col).toBeDefined();
  });

  it('has status column with default active', () => {
    const col = allColumns(UserEntity).find((c) => c.propertyName === 'status');
    expect(col).toBeDefined();
    expect(col?.options.default).toBe('active');
  });

  it('has lastLoginAt nullable column', () => {
    const col = allColumns(UserEntity).find(
      (c) => c.propertyName === 'lastLoginAt',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has avatarUrl nullable column', () => {
    const col = allColumns(UserEntity).find(
      (c) => c.propertyName === 'avatarUrl',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('extends BaseEntity (has createdAt inherited)', () => {
    const col = allColumns(BaseEntity).find(
      (c) => c.propertyName === 'createdAt',
    );
    expect(col).toBeDefined();
    expect(UserEntity.prototype).toBeInstanceOf(BaseEntity);
  });

  it('soft-delete column (deletedAt) is defined on BaseEntity', () => {
    const storage = getMetadataArgsStorage();
    const col = storage.columns.find(
      (c) => c.target === BaseEntity && c.propertyName === 'deletedAt',
    );
    expect(col).toBeDefined();
  });
});
