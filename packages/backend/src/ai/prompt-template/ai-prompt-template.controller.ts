import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { CreateAiPromptTemplateDto } from './dto/create-ai-prompt-template.dto';
import { UpdateAiPromptTemplateDto } from './dto/update-ai-prompt-template.dto';
import { AiPromptOperation, AiPromptTemplateEntity } from './ai-prompt-template.entity';
import { RequestContextService } from '../../request-context/request-context.service';
import { AbilityGuard } from '../../auth/guards/ability.guard';
import { RequireAbility } from '../../auth/decorators/require-ability.decorator';
import type { AppAbility } from '../../auth/casl/ability.types';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@Controller('ai-prompt-templates')
export class AiPromptTemplateController {
  constructor(
    private readonly service: AiPromptTemplateService,
    private readonly requestContext: RequestContextService,
  ) {}

  @ApiOperation({ summary: 'List prompt templates for the current workspace' })
  @ApiQuery({ name: 'operation', required: false })
  @Get()
  list(@Query('operation') operation?: AiPromptOperation): Promise<AiPromptTemplateEntity[]> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.service.list(workspaceId, { operation });
  }

  @ApiOperation({ summary: 'Get a single prompt template' })
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<AiPromptTemplateEntity> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.service.getById(workspaceId, id);
  }

  @ApiOperation({ summary: 'Create a custom prompt template' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AbilityGuard)
  @RequireAbility((ability: AppAbility) => ability.can('manage', 'Workspace'))
  create(@Body() dto: CreateAiPromptTemplateDto): Promise<AiPromptTemplateEntity> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;
    return this.service.create(workspaceId, userId, dto);
  }

  @ApiOperation({ summary: 'Update a custom prompt template' })
  @Patch(':id')
  @UseGuards(AbilityGuard)
  @RequireAbility((ability: AppAbility) => ability.can('manage', 'Workspace'))
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiPromptTemplateDto,
  ): Promise<AiPromptTemplateEntity> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;
    return this.service.update(workspaceId, userId, id, dto);
  }

  @ApiOperation({ summary: 'Promote a template to be the default for its operation' })
  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AbilityGuard)
  @RequireAbility((ability: AppAbility) => ability.can('manage', 'Workspace'))
  setDefault(@Param('id', ParseUUIDPipe) id: string): Promise<AiPromptTemplateEntity> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;
    return this.service.setDefault(workspaceId, userId, id);
  }

  @ApiOperation({ summary: 'Soft-delete a custom prompt template' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AbilityGuard)
  @RequireAbility((ability: AppAbility) => ability.can('manage', 'Workspace'))
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;
    await this.service.remove(workspaceId, userId, id);
  }
}
