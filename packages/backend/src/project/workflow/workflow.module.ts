import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowTransitionEntity } from './workflow-transition.entity';
import { WorkflowTransitionService } from './workflow-transition.service';
import { WorkflowTransitionController } from './workflow-transition.controller';
import { StatusEntity } from '../status/status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowTransitionEntity, StatusEntity])],
  providers: [WorkflowTransitionService],
  controllers: [WorkflowTransitionController],
  exports: [WorkflowTransitionService],
})
export class WorkflowModule {}
