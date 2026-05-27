import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AiGenerateCommitResponse,
  AiGenerateDraftResponse,
} from '@jitre/shared';
import { AiQuotaGuard } from '../ai-quota.guard';
import { RequestContextService } from '../../request-context/request-context.service';
import { AbilityGuard } from '../../auth/guards/ability.guard';
import { RequireAbility } from '../../auth/decorators/require-ability.decorator';
import type { AppAbility } from '../../auth/casl/ability.types';
import { AiGeneratorService } from './ai-generator.service';
import { AiGenerateDraftDto } from './dto/ai-generate-draft.dto';
import { AiGenerateCommitDto } from './dto/ai-generate-commit.dto';
import { WorkspaceRole } from '@jitre/shared';

function isWorkspaceAdmin(role: WorkspaceRole | null | undefined): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai/generate')
export class AiGeneratorController {
  constructor(
    private readonly generator: AiGeneratorService,
    private readonly requestContext: RequestContextService,
  ) {}

  @ApiOperation({
    summary: 'Generate a structured draft from a natural-language prompt',
  })
  @ApiResponse({ status: 200, description: 'Draft generated.' })
  @ApiResponse({ status: 429, description: 'AI quota exceeded.' })
  @ApiResponse({ status: 502, description: 'AI response could not be parsed.' })
  @Post('draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiQuotaGuard)
  async draft(@Body() dto: AiGenerateDraftDto): Promise<AiGenerateDraftResponse> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;

    return this.generator.draft({
      workspaceId,
      userId,
      prompt: dto.prompt,
      projectId: dto.context?.projectId,
    });
  }

  @ApiOperation({
    summary: 'Materialize an edited draft into real entities (task or task+subtasks)',
  })
  @ApiResponse({ status: 201, description: 'Entities created.' })
  @ApiResponse({ status: 400, description: 'Draft is missing required context.' })
  @Post('commit')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AbilityGuard)
  @RequireAbility((ability: AppAbility) => ability.can('create', 'Task'))
  async commit(@Body() dto: AiGenerateCommitDto): Promise<AiGenerateCommitResponse> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;
    const role = this.requestContext.getRole();

    return this.generator.commit({
      workspaceId,
      userId,
      isWorkspaceAdmin: isWorkspaceAdmin(role),
      draft: dto.draft,
    });
  }
}
