import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { QUEUES } from '../queues.constants';
import { Notification } from '../../notification/notification.entity';

interface EmailDriverLike {
  send(notification: Notification): Promise<void>;
}

export interface DrainEmailJobPayload {
  notificationId: string;
}

@Injectable()
@Processor(QUEUES.EMAIL)
export class DrainEmailNotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(DrainEmailNotificationsProcessor.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly emailDriver: EmailDriverLike,
  ) {
    super();
  }

  async process(job: Job<DrainEmailJobPayload>): Promise<void> {
    const { notificationId } = job.data;

    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    await this.emailDriver.send(notification);

    notification.emailSentAt = new Date();
    await this.notificationRepo.save(notification);

    this.logger.log(`Email sent for notification ${notificationId}`);
  }
}
