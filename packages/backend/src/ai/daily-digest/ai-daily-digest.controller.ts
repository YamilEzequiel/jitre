import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AiDailyDigestService } from './ai-daily-digest.service';
import { AiDailyDigestEntity } from './ai-daily-digest.entity';
import { RequestContextService } from '../../request-context/request-context.service';
import { AbilityGuard } from '../../auth/guards/ability.guard';
import { RequireAbility } from '../../auth/decorators/require-ability.decorator';
import type { AppAbility } from '../../auth/casl/ability.types';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai/daily-digest')
export class AiDailyDigestController {
  constructor(
    private readonly service: AiDailyDigestService,
    private readonly requestContext: RequestContextService,
  ) {}

  @ApiOperation({ summary: 'Get the latest digest for the current workspace' })
  @Get('latest')
  async latest(): Promise<AiDailyDigestEntity | null> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const recent = await this.service.listRecent(workspaceId, 1);
    return recent[0] ?? null;
  }

  @ApiOperation({ summary: 'List recent digests (default 7)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  list(@Query('limit') limit?: string): Promise<AiDailyDigestEntity[]> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const n = limit ? Math.min(Math.max(parseInt(limit, 10) || 7, 1), 30) : 7;
    return this.service.listRecent(workspaceId, n);
  }

  @ApiOperation({ summary: 'Get the digest for a specific date (YYYY-MM-DD)' })
  @Get(':date')
  byDate(@Param('date') date: string): Promise<AiDailyDigestEntity | null> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.service.getByDate(workspaceId, date);
  }

  @ApiOperation({ summary: 'Regenerate the digest for yesterday (admin only)' })
  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AbilityGuard)
  @RequireAbility((ability: AppAbility) => ability.can('manage', 'Workspace'))
  regenerate(): Promise<AiDailyDigestEntity> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.service.generateFor(workspaceId);
  }
}
