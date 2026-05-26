import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusEntity } from './status.entity';
import { TaskEntity } from '../../task/task.entity';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([StatusEntity, TaskEntity]), EventsModule],
  providers: [StatusService],
  controllers: [StatusController],
  exports: [StatusService],
})
export class StatusModule {}
