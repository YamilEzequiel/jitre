import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiAutoPrioritizeService } from './ai-auto-prioritize.service';
import { AiPrioritySuggestionEntity } from './ai-priority-suggestion.entity';
import { RequestContextService } from '../../request-context/request-context.service';
import { AbilityGuard } from '../../auth/guards/ability.guard';
import { RequireAbility } from '../../auth/decorators/require-ability.decorator';
import type { AppAbility } from '../../auth/casl/ability.types';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai/priority-suggestions')
export class AiAutoPrioritizeController {
  constructor(
    private readonly service: AiAutoPrioritizeService,
    private readonly requestContext: RequestContextService,
  ) {}

  @ApiOperation({ summary: 'List open priority suggestions for the workspace' })
  @Get()
  list(): Promise<AiPrioritySuggestionEntity[]> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.service.listOpen(workspaceId);
  }

  @ApiOperation({ summary: 'Suggestions linked to a specific task' })
  @Get('task/:taskId')
  listForTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<AiPrioritySuggestionEntity[]> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.service.listForTask(workspaceId, taskId);
  }

  @ApiOperation({ summary: 'Accept a suggestion (applies the priority change)' })
  @Post(':id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  async accept(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;
    await this.service.accept(workspaceId, id, userId);
  }

  @ApiOperation({ summary: 'Dismiss a suggestion (no priority change)' })
  @Post(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;
    await this.service.dismiss(workspaceId, id, userId);
  }

  @ApiOperation({ summary: 'Regenerate suggestions for the workspace (admin only)' })
  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AbilityGuard)
  @RequireAbility((ability: AppAbility) => ability.can('manage', 'Workspace'))
  regenerate(): Promise<{ created: number; stale: number }> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.service.generateFor(workspaceId);
  }
}
