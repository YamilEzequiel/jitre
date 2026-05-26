import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { ClsServiceManager } from 'nestjs-cls';
import { BaseEntity } from '../../common/entities/base.entity';
import { RC_KEYS } from '../../request-context/request-context.service';

/**
 * TypeORM EntitySubscriber that auto-populates `createdBy` and `updatedBy`
 * from the current CLS context. Subscribers run outside of NestJS DI, so we
 * reach the active CLS store via `ClsServiceManager.getClsService()`.
 *
 * If no userId is present in the context (anonymous / system call), the
 * fields stay `null` — that's the contract: explicit "no actor".
 */
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface<BaseEntity> {
  listenTo(): typeof BaseEntity {
    return BaseEntity;
  }

  beforeInsert(event: InsertEvent<BaseEntity>): void {
    const userId = AuditSubscriber.currentUserId();
    if (event.entity) {
      if (
        event.entity.createdBy === undefined ||
        event.entity.createdBy === null
      ) {
        event.entity.createdBy = userId;
      }
      if (
        event.entity.updatedBy === undefined ||
        event.entity.updatedBy === null
      ) {
        event.entity.updatedBy = userId;
      }
    }
  }

  beforeUpdate(event: UpdateEvent<BaseEntity>): void {
    const userId = AuditSubscriber.currentUserId();
    if (event.entity) {
      (event.entity as BaseEntity).updatedBy = userId;
    }
  }

  private static currentUserId(): string | null {
    try {
      const cls = ClsServiceManager.getClsService();
      const value = cls.get<string | null>(RC_KEYS.USER_ID);
      return value ?? null;
    } catch {
      // No active CLS context (e.g. seeders, migrations) — leave as null.
      return null;
    }
  }
}
