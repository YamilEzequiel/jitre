import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationService } from './notification.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { InAppNotificationDriver } from './drivers/in-app-notification.driver';
import { EmailNotificationDriver } from './drivers/email-notification.driver';
import { NOTIFICATION_DRIVERS } from './drivers/notification-driver.interface';
import { NotificationListener } from './notification.listener';
import { NotificationController } from './notification.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), SettingsModule],
  providers: [
    NotificationService,
    NotificationDispatcherService,
    InAppNotificationDriver,
    EmailNotificationDriver,
    {
      provide: NOTIFICATION_DRIVERS,
      useFactory: (inApp: InAppNotificationDriver, email: EmailNotificationDriver) => [
        inApp,
        email,
      ],
      inject: [InAppNotificationDriver, EmailNotificationDriver],
    },
    NotificationListener,
  ],
  controllers: [NotificationController],
  exports: [NotificationService, NotificationDispatcherService],
})
export class NotificationModule {}
