import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationEntity, AutomationRunEntity } from './automation.entity';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationEngine } from './automation.engine';

/**
 * Automations live cross-cutting: the engine listens to domain events from
 * tasks/comments/etc. and dispatches actions back into those same services
 * via ModuleRef. `@Global` keeps the engine available without forcing every
 * domain module to import it.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AutomationEntity, AutomationRunEntity])],
  providers: [AutomationService, AutomationEngine],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
