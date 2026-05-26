import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ActivityTimelineService } from './activity-timeline.service';
import { ActivityController } from './activity.controller';

@Module({
  imports: [AuditModule],
  providers: [ActivityTimelineService],
  controllers: [ActivityController],
})
export class ActivityModule {}
