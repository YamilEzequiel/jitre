import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { NotificationEmailListener } from './notification-email.listener';
import { Notification } from '../notification/notification.entity';
import { UserEntity } from '../user/user.entity';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { SettingsModule } from '../settings/settings.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    SettingsModule,
    TypeOrmModule.forFeature([Notification, UserEntity, WorkspaceEntity]),
  ],
  providers: [EmailService, NotificationEmailListener],
  exports: [EmailService],
})
export class EmailModule {}
