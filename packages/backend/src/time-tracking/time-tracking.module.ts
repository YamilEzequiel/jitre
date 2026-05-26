import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntryEntity } from './time-entry.entity';
import { TaskEntity } from '../task/task.entity';
import { TimeEntryService } from './time-entry.service';
import { TimeEntryController } from './time-entry.controller';

/**
 * TimeTrackingModule — Tempo-style time entries.
 *
 * - Logs are workspace-scoped via {@link TimeEntryEntity}.
 * - Visibility & mutation rules enforced in the service layer:
 *   workspace OWNER/ADMIN see/manage all; everyone else is scoped to self.
 * - Reports are SQL `GROUP BY` aggregates (no in-memory bucketing).
 *
 * NOTE: the TypeORM repository for {@link TaskEntity} is imported (read-only)
 * so the service can assert tasks belong to the same workspace without
 * depending on the full `TaskModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TimeEntryEntity, TaskEntity])],
  providers: [TimeEntryService],
  controllers: [TimeEntryController],
  exports: [TimeEntryService],
})
export class TimeTrackingModule {}
