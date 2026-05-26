import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeEvent, RealtimeEventPayloads } from '@jitre/shared';
import { ProjectMembershipService } from '../project/project-membership/project-membership.service';
import { SubscribeTaskDto } from './dto/subscribe-task.dto';
import { SubscribeProjectDto } from './dto/subscribe-project.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { WsBackpressureMiddleware } from './middleware/ws-backpressure.middleware';

export interface SocketData {
  userId: string;
  workspaceId: string;
  requestId: string;
  /** S1: tracks joined subscription rooms (excludes default/personal/workspace rooms) */
  roomCount?: number;
}

const WS_MAX_ROOMS = () => {
  const raw = process.env['WS_MAX_ROOMS_PER_SOCKET'];
  const parsed = raw ? parseInt(raw, 10) : 100;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
};

@Injectable()
@WebSocketGateway({
  path: '/ws',
  cors: { origin: '*', credentials: true },
  transports: ['websocket'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly projectMembershipService: ProjectMembershipService,
    private readonly logger: Logger,
    @Optional() private readonly backpressure: WsBackpressureMiddleware | null,
  ) {}

  afterInit(_server: Server): void {
    this.logger.log('RealtimeGateway initialized');
  }

  async handleConnection(socket: Socket & { data: SocketData }): Promise<void> {
    const { userId, workspaceId } = socket.data ?? {};
    if (!userId || !workspaceId) {
      this.logger.warn({
        event: 'ws.connect.rejected',
        socketId: socket.id,
        reason: 'missing auth data',
      });
      socket.disconnect(true);
      return;
    }

    // S1: initialize room counter (excludes default/personal/workspace auto-rooms)
    socket.data.roomCount = 0;

    await socket.join(`user:${userId}`);
    await socket.join(`workspace:${workspaceId}`);

    this.logger.log({
      event: 'ws.connect',
      userId,
      workspaceId,
      socketId: socket.id,
    });
  }

  handleDisconnect(socket: Socket & { data: SocketData }): Promise<void> {
    const { userId, workspaceId } = socket.data ?? {};
    this.logger.log({
      event: 'ws.disconnect',
      userId,
      workspaceId,
      socketId: socket.id,
    });
    return Promise.resolve();
  }

  @SubscribeMessage('subscribe.task')
  async onSubscribeTask(
    @ConnectedSocket() socket: Socket & { data: SocketData },
    @MessageBody() dto: SubscribeTaskDto,
  ): Promise<void> {
    const { userId, workspaceId } = socket.data;

    // S1: quota check
    if ((socket.data.roomCount ?? 0) >= WS_MAX_ROOMS()) {
      throw new WsException('SUBSCRIPTION_QUOTA');
    }

    const membership = await this.projectMembershipService.findMembership(
      dto.projectId,
      workspaceId,
      userId,
    );
    if (!membership) {
      throw new WsException('FORBIDDEN');
    }
    await socket.join(`task:${dto.taskId}`);
    socket.data.roomCount = (socket.data.roomCount ?? 0) + 1;
  }

  @SubscribeMessage('subscribe.project')
  async onSubscribeProject(
    @ConnectedSocket() socket: Socket & { data: SocketData },
    @MessageBody() dto: SubscribeProjectDto,
  ): Promise<void> {
    const { userId, workspaceId } = socket.data;

    // S1: quota check
    if ((socket.data.roomCount ?? 0) >= WS_MAX_ROOMS()) {
      throw new WsException('SUBSCRIPTION_QUOTA');
    }

    const membership = await this.projectMembershipService.findMembership(
      dto.projectId,
      workspaceId,
      userId,
    );
    if (!membership) {
      throw new WsException('FORBIDDEN');
    }
    await socket.join(`project:${dto.projectId}`);
    socket.data.roomCount = (socket.data.roomCount ?? 0) + 1;
  }

  @SubscribeMessage('unsubscribe')
  async onUnsubscribe(
    @ConnectedSocket() socket: Socket & { data: SocketData },
    @MessageBody() dto: UnsubscribeDto,
  ): Promise<void> {
    const wasIn = socket.rooms.has(dto.room);
    await socket.leave(dto.room);
    // S1: decrement counter only if was actually in the room
    if (wasIn) {
      socket.data.roomCount = Math.max(0, (socket.data.roomCount ?? 0) - 1);
    }
  }

  /**
   * S1: Tracked leave for kick path (called by RealtimeListener.onProjectMemberRemoved).
   * Decrements roomCount when forcing a socket out of a room.
   */
  leaveRoomTracked(socket: Socket & { data: SocketData }, room: string): void {
    const wasIn = socket.rooms.has(room);
    void socket.leave(room);
    if (wasIn) {
      socket.data.roomCount = Math.max(0, (socket.data.roomCount ?? 0) - 1);
    }
  }

  /**
   * Public API for RealtimeListener to emit typed payloads into rooms.
   * S2: When WsBackpressureMiddleware is wired, checks per-room rate limit before emitting.
   * Uses room as the rate-limit key (server-side fan-out — no per-socket context available here).
   * Falls open when backpressure middleware is absent (R6 — never hard-fail realtime).
   */
  async emitToRoom<E extends RealtimeEvent>(
    room: string,
    event: E,
    payload: RealtimeEventPayloads[E],
  ): Promise<void> {
    // S2: backpressure check (per-room key for server-side fan-out)
    if (this.backpressure) {
      const allowed = await this.backpressure.checkAndConsume(room);
      if (!allowed) {
        this.logger.warn({
          event: 'ws.emitToRoom.backpressure.drop',
          room,
          emitEvent: event,
        });
        return;
      }
    }

    this.server.to(room).emit(event, payload);
  }
}
