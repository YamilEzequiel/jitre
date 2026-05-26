import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity } from './workspace.entity';
import { WorkspaceMembershipEntity } from './workspace-membership.entity';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { AttachmentModule } from '../attachment/attachment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity, WorkspaceMembershipEntity]),
    AttachmentModule,
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
