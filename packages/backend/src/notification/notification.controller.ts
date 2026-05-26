import { Controller, Get, Patch, Param, Query, Req } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { NotificationService } from './notification.service';
import { RequestContextService } from '../request-context/request-context.service';
import type { Page } from '../audit/audit-log.service';
import type { Notification } from './notification.entity';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly requestContext: RequestContextService,
  ) {}

  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiResponse({ status: 200, description: 'Paginated notification entries.' })
  @Get()
  async list(
    @Query() query: ListNotificationsDto,
    @Req() req: Request & { user?: { id: string } },
  ): Promise<Page<Notification>> {
    const userId = req.user!.id;
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.notificationService.listForUser(userId, workspaceId, {
      unreadOnly: query.unreadOnly,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Updated notification.' })
  @ApiResponse({ status: 403, description: 'NOT_RECIPIENT' })
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Req() req: Request & { user?: { id: string } },
  ): Promise<Notification> {
    return this.notificationService.markAsRead(
      id,
      req.user!.id,
      this.requestContext.getWorkspaceId()!,
    );
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: '{ updated: number }' })
  @Patch('read-all')
  async markAllAsRead(
    @Req() req: Request & { user?: { id: string } },
  ): Promise<{ updated: number }> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.notificationService.markAllAsRead(req.user!.id, workspaceId);
  }
}
