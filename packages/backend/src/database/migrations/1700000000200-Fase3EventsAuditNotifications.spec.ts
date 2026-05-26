import type { QueryRunner } from 'typeorm';
import { Fase3EventsAuditNotifications1700000000200 } from './1700000000200-Fase3EventsAuditNotifications';

describe('Fase3EventsAuditNotifications1700000000200', () => {
  let migration: Fase3EventsAuditNotifications1700000000200;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase3EventsAuditNotifications1700000000200();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates audit_logs table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE "audit_logs"'),
      );
    });

    it('creates uq_audit_event_id unique index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('uq_audit_event_id'),
      );
    });

    it('creates idx_audit_ws_time index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('idx_audit_ws_time'),
      );
    });

    it('creates fk_audit_workspace FK', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('fk_audit_workspace'),
      );
    });

    it('creates notifications table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE "notifications"'),
      );
    });

    it('creates fk_notif_recipient FK', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('fk_notif_recipient'),
      );
    });
  });

  describe('down()', () => {
    it('drops notifications before audit_logs', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = (queryRunner.query as jest.Mock).mock.calls.map(
        (c: string[]) => c[0],
      );
      const notifIdx = calls.findIndex((q: string) =>
        q.includes('notifications'),
      );
      const auditIdx = calls.findIndex((q: string) => q.includes('audit_logs'));
      expect(notifIdx).toBeLessThan(auditIdx);
    });
  });
});
