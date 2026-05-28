import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPromptTemplateEntity } from './ai-prompt-template.entity';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiPromptTemplateController } from './ai-prompt-template.controller';
import { CaslAbilityFactory } from '../../auth/casl/ability.factory';
import { AbilityGuard } from '../../auth/guards/ability.guard';
import { WorkspaceMembershipEntity } from '../../workspace/workspace-membership.entity';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { ProjectModule } from '../../project/project.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiPromptTemplateEntity, WorkspaceMembershipEntity]),
    // AbilityGuard pulls WorkspaceService + ProjectMembershipService for tenancy
    // and role checks; we have to import the modules that export them.
    WorkspaceModule,
    ProjectModule,
  ],
  providers: [AiPromptTemplateService, CaslAbilityFactory, AbilityGuard],
  controllers: [AiPromptTemplateController],
  exports: [AiPromptTemplateService],
})
export class AiPromptTemplateModule {}
