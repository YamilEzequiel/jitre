import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaEntity } from './area.entity';
import { UserEntity } from '../user/user.entity';
import { ProjectEntity } from '../project/project.entity';
import { AreaService } from './area.service';
import { AreaController } from './area.controller';

/**
 * Areas / departments — workspace-scoped grouping for users and projects.
 *
 * Owns the `AreaEntity` repository plus references to `UserEntity` and
 * `ProjectEntity` so the service can nullify `users.area_id` /
 * `projects.area_id` when an area is soft-deleted (see `AreaService.softDelete`).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AreaEntity, UserEntity, ProjectEntity]),
  ],
  controllers: [AreaController],
  providers: [AreaService],
  exports: [AreaService],
})
export class AreaModule {}
