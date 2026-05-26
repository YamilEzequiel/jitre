import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './document.entity';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { RequestContextModule } from '../request-context/request-context.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CaslAbilityFactory } from '../auth/casl/ability.factory';
import { AbilityGuard } from '../auth/guards/ability.guard';
import { ProjectModule } from '../project/project.module';

/**
 * DocumentModule — Docs/Wiki pages.
 *
 * Document events are consumed by IndexerListener so docs are searchable.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    RequestContextModule,
    WorkspaceModule,
    ProjectModule,
  ],
  providers: [DocumentService, CaslAbilityFactory, AbilityGuard],
  controllers: [DocumentController],
  exports: [DocumentService],
})
export class DocumentModule {}
