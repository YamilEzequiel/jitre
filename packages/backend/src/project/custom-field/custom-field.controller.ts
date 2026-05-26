import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import type { Request } from 'express';
import { CustomFieldService } from './custom-field.service';
import { CustomFieldType, CustomFieldScope } from '@jitre/shared';

class CreateCustomFieldDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: CustomFieldType })
  @IsEnum(CustomFieldType)
  type!: CustomFieldType;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() options?:
    | string[]
    | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional({ enum: CustomFieldScope })
  @IsOptional()
  @IsEnum(CustomFieldScope)
  scope?: CustomFieldScope;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() projectId?:
    | string
    | null;
}

class UpdateCustomFieldDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() options?:
    | string[]
    | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
}

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string };
};

@ApiTags('custom-fields')
@ApiBearerAuth('access-token')
@Controller('custom-fields')
export class CustomFieldController {
  constructor(private readonly service: CustomFieldService) {}

  @ApiOperation({ summary: 'Create a custom field' })
  @ApiResponse({ status: 201 })
  @ApiResponse({
    status: 400,
    description: 'SELECT/MULTI_SELECT requires options.',
  })
  @ApiSecurity('workspace')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCustomFieldDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.create({
      workspaceId: req.workspace!.id,
      ...dto,
      actorUserId: req.user!.id,
    });
  }

  @ApiOperation({ summary: 'List custom fields' })
  @ApiResponse({ status: 200 })
  @Get()
  async list(
    @Req() req: AuthRequest,
    @Query('projectId') projectId?: string,
  ): Promise<unknown[]> {
    return this.service.list({ projectId, workspaceId: req.workspace!.id });
  }

  @ApiOperation({ summary: 'Update a custom field' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  @ApiSecurity('workspace')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.update(id, req.workspace!.id, { ...dto, actorUserId: req.user!.id });
  }

  @ApiOperation({ summary: 'Delete a custom field' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  @ApiSecurity('workspace')
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.service.delete(id, req.workspace!.id, { actorUserId: req.user!.id });
  }
}
