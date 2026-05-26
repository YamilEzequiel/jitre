import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NotificationType } from '@jitre/shared';
import { Notification } from './notification.entity';
import type { Page } from '../audit/audit-log.service';
import { EventBusService } from '../events/event-bus.service';
import { NotificationCreatedEvent } from './events/notification-created.event';

export interface NotificationCreateInput {
  workspaceId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high';
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly eventBus: EventBusService,
  ) {}

  async create(input: NotificationCreateInput): Promise<Notification> {
    const entity = this.repo.create({
      workspaceId: input.workspaceId,
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      data: input.data ?? {},
      priority: input.priority ?? 'normal',
      occurredAt: new Date(),
    });
    const saved = await this.repo.save(entity);

    this.eventBus.publish(
      new NotificationCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Notification',
        workspaceId: input.workspaceId,
        payload: {
          notificationId: saved.id,
          recipientUserId: input.recipientUserId,
          type: input.type,
        },
      }),
    );

    return saved;
  }

  async listForUser(
    userId: string,
    workspaceId: string,
    options: { unreadOnly?: boolean; page: number; pageSize: number },
  ): Promise<Page<Notification>> {
    const where: Record<string, unknown> = {
      recipientUserId: userId,
      workspaceId,
    };
    if (options.unreadOnly) {
      where['readAt'] = IsNull();
    }
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { occurredAt: 'DESC' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    });
    return { items, total, page: options.page, pageSize: options.pageSize };
  }

  async markAsRead(id: string, userId: string, workspaceId: string): Promise<Notification> {
    const notif = await this.repo.findOne({ where: { id, workspaceId } });
    if (!notif || notif.recipientUserId !== userId) {
      throw new ForbiddenException('NOT_RECIPIENT');
    }
    if (notif.readAt !== null) {
      return notif;
    }
    notif.readAt = new Date();
    return this.repo.save(notif);
  }

  async markAllAsRead(
    userId: string,
    workspaceId: string,
  ): Promise<{ updated: number }> {
    const result = await this.repo.update(
      {
        recipientUserId: userId,
        workspaceId,
        readAt: IsNull() as unknown as Date,
      },
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }
}
