import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { SettingsService, MergedUserPreferences } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { OWNER_ONLY_KEYS, KNOWN_KEYS } from './settings-keys.constants';

const USER_ALLOWED_SCOPES = new Set([
  ...KNOWN_KEYS.user,
  ...KNOWN_KEYS.notification,
]);

@ApiTags('settings')
@ApiBearerAuth('access-token')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── /settings/me ───────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get merged effective settings for current user' })
  @ApiResponse({ status: 200 })
  @Get('me')
  async getMySettings(@Req() req: Request): Promise<MergedUserPreferences> {
    const userId = (req.user as { userId: string }).userId;
    const workspaceId =
      (req.headers['x-workspace-id'] as string | undefined) ?? '';
    return this.settingsService.getMergedUserPreferences(userId, workspaceId);
  }

  @ApiOperation({ summary: 'Update a user or notification setting' })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 400,
    description: 'Key not in user/notification allowlist',
  })
  @Patch('me')
  async patchMySettings(
    @Req() req: Request,
    @Body() dto: UpdateSettingDto,
  ): Promise<void> {
    if (!(USER_ALLOWED_SCOPES as Set<string>).has(dto.key)) {
      throw new BadRequestException('Key not in user/notification allowlist');
    }

    const userId = (req.user as { userId: string }).userId;
    const workspaceId =
      (req.headers['x-workspace-id'] as string | undefined) ?? '';

    if (
      KNOWN_KEYS.notification.includes(
        dto.key as (typeof KNOWN_KEYS.notification)[number],
      )
    ) {
      await this.settingsService.setNotificationSetting(
        userId,
        workspaceId || null,
        dto.key,
        dto.value,
      );
    } else {
      await this.settingsService.setUserSetting(userId, dto.key, dto.value);
    }
  }

  // ── /settings/workspace ────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get workspace settings (member+)' })
  @ApiResponse({ status: 200 })
  @Get('workspace')
  async getWorkspaceSettings(@Query('workspaceId') workspaceId: string) {
    const results = await Promise.all(
      KNOWN_KEYS.workspace.map(async (key) => ({
        key,
        value: await this.settingsService.getWorkspaceSetting(workspaceId, key),
      })),
    );
    return Object.fromEntries(results.map((r) => [r.key, r.value]));
  }

  @ApiOperation({ summary: 'Update a workspace setting (ADMIN+)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 403,
    description: 'OWNER-only key or INSUFFICIENT_ROLE',
  })
  @Patch('workspace')
  @RequireRole(WorkspaceRole.ADMIN)
  async patchWorkspaceSettings(
    @Req() req: Request,
    @Body() dto: UpdateSettingDto,
  ): Promise<void> {
    const role = (req.user as { role?: string })?.role;

    if (OWNER_ONLY_KEYS.has(dto.key) && role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('owner_only_setting');
    }

    await this.settingsService.setWorkspaceSetting(
      dto.workspaceId!,
      dto.key,
      dto.value,
    );
  }

  // ── /settings/ai ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get AI settings for a workspace (ADMIN+)' })
  @ApiResponse({ status: 200 })
  @Get('ai')
  @RequireRole(WorkspaceRole.ADMIN)
  async getAiSettings(@Query('workspaceId') workspaceId: string) {
    const results = await Promise.all(
      KNOWN_KEYS.ai.map(async (key) => ({
        key,
        value: await this.settingsService.getAiSetting(workspaceId, key),
      })),
    );
    return Object.fromEntries(results.map((r) => [r.key, r.value]));
  }

  @ApiOperation({ summary: 'Update an AI setting (ADMIN+)' })
  @ApiResponse({ status: 200 })
  @Patch('ai')
  @RequireRole(WorkspaceRole.ADMIN)
  async patchAiSettings(@Body() dto: UpdateSettingDto): Promise<void> {
    await this.settingsService.setAiSetting(
      dto.workspaceId!,
      dto.key,
      dto.value,
    );
  }
}
