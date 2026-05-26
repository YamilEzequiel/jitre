import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelEntity } from './label.entity';
import { TaskLabelEntity } from '../../task/task-label.entity';
import { LabelService } from './label.service';
import { LabelController } from './label.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LabelEntity, TaskLabelEntity]),
    EventsModule,
  ],
  providers: [LabelService],
  controllers: [LabelController],
  exports: [LabelService],
})
export class LabelModule {}
