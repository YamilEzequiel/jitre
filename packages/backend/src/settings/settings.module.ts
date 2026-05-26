import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSetting } from './user-setting.entity';
import { WorkspaceSetting } from './workspace-setting.entity';
import { AiSetting } from './ai-setting.entity';
import { NotificationSetting } from './notification-setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserSetting,
      WorkspaceSetting,
      AiSetting,
      NotificationSetting,
    ]),
  ],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
