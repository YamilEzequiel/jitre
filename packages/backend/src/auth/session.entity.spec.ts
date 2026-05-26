import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { SessionEntity } from './session.entity';
import { UserEntity } from '../user/user.entity';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('SessionEntity', () => {
  it('is decorated with @Entity("sessions")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === SessionEntity);
    expect(table?.name).toBe('sessions');
  });

  it('has userId column', () => {
    const col = ownColumns(SessionEntity).find(
      (c) => c.propertyName === 'userId',
    );
    expect(col).toBeDefined();
  });

  it('has refreshTokenHash column', () => {
    const col = ownColumns(SessionEntity).find(
      (c) => c.propertyName === 'refreshTokenHash',
    );
    expect(col).toBeDefined();
  });

  it('excludes refreshTokenHash from JSON serialization', () => {
    const instance = new SessionEntity();
    instance.refreshTokenHash = 'secret-hash';
    const json = JSON.parse(JSON.stringify(instance));
    expect(json.refreshTokenHash).toBeUndefined();
  });

  it('has deviceInfo column of type jsonb', () => {
    const col = ownColumns(SessionEntity).find(
      (c) => c.propertyName === 'deviceInfo',
    );
    expect(col).toBeDefined();
    expect(col?.options.type).toBe('jsonb');
  });

  it('has lastUsedAt column', () => {
    const col = ownColumns(SessionEntity).find(
      (c) => c.propertyName === 'lastUsedAt',
    );
    expect(col).toBeDefined();
  });

  it('has expiresAt column', () => {
    const col = ownColumns(SessionEntity).find(
      (c) => c.propertyName === 'expiresAt',
    );
    expect(col).toBeDefined();
  });

  it('has ManyToOne relation to UserEntity', () => {
    const storage = getMetadataArgsStorage();
    const rel = storage.relations.find(
      (r) => r.target === SessionEntity && r.propertyName === 'user',
    );
    expect(rel).toBeDefined();
    expect(rel?.relationType).toBe('many-to-one');
    const relType = (rel?.type as () => typeof UserEntity)();
    expect(relType).toBe(UserEntity);
  });
});
