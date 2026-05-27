import { Injectable, Logger } from '@nestjs/common';
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
import { ChatService } from './chat.service';
import { WsJwtMiddleware } from '../realtime/middleware/ws-jwt.middleware';

export interface ChatSocketData {
  userId: string;
  workspaceId: string;
  requestId: string;
}

export interface ChatRoomDto {
  channelId: string;
}

/**
 * ChatGateway — namespace `/chat`. Uses the same JWT middleware as RealtimeGateway.
 *
 * Presence model is intentionally simple: an in-memory `Map<userId, count>`
 * tracks how many sockets that user has open in this process. On connect we
 * increment; if the user transitions 0 → 1 we broadcast `chat:presence` to the
 * workspace room. On disconnect we decrement; on 1 → 0 we broadcast offline.
 * This is a per-process counter — when we scale horizontally we'll graduate
 * to Redis-backed presence.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  path: '/ws',
  cors: { origin: '*', credentials: true },
  transports: ['websocket'],
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  /** userId → number of open sockets in this process */
  private readonly connectionCounts = new Map<string, number>();

  constructor(
    private readonly chatService: ChatService,
    private readonly logger: Logger,
    private readonly jwtMiddleware: WsJwtMiddleware,
  ) {}

  afterInit(server: Server): void {
    // Install JWT middleware on the namespace so this gateway authenticates
    // independently of RealtimeGateway.
    try {
      server.use((socket, next) => {
        void this.jwtMiddleware.use(socket as never, next);
      });
    } catch (err: unknown) {
      this.logger.warn({ event: 'chat.gateway.middleware_install_failed', err });
    }
    this.logger.log('ChatGateway initialized');
  }

  async handleConnection(
    socket: Socket & { data: ChatSocketData },
  ): Promise<void> {
    const { userId, workspaceId } = socket.data ?? ({} as ChatSocketData);
    if (!userId || !workspaceId) {
      this.logger.warn({
        event: 'chat.ws.connect.rejected',
        socketId: socket.id,
        reason: 'missing auth data',
      });
      socket.disconnect(true);
      return;
    }

    await socket.join(`user:${userId}`);
    await socket.join(`workspace:${workspaceId}`);

    const next = (this.connectionCounts.get(userId) ?? 0) + 1;
    this.connectionCounts.set(userId, next);
    if (next === 1) {
      this.broadcastPresence(workspaceId, userId, true);
    }

    this.logger.log({
      event: 'chat.ws.connect',
      userId,
      workspaceId,
      socketId: socket.id,
    });
  }

  handleDisconnect(socket: Socket & { data: ChatSocketData }): void {
    const { userId, workspaceId } = socket.data ?? ({} as ChatSocketData);
    if (!userId || !workspaceId) {
      return;
    }
    const current = this.connectionCounts.get(userId) ?? 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      this.connectionCounts.delete(userId);
      this.broadcastPresence(workspaceId, userId, false);
    } else {
      this.connectionCounts.set(userId, next);
    }

    this.logger.log({
      event: 'chat.ws.disconnect',
      userId,
      workspaceId,
      socketId: socket.id,
    });
  }

  isOnline(userId: string): boolean {
    return (this.connectionCounts.get(userId) ?? 0) > 0;
  }

  // ── Client → Server ─────────────────────────────────────────────────────

  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() socket: Socket & { data: ChatSocketData },
    @MessageBody() dto: ChatRoomDto,
  ): Promise<void> {
    const { userId } = socket.data;
    if (!dto?.channelId) {
      throw new WsException('CHANNEL_REQUIRED');
    }
    const isMember = await this.chatService.isMember(dto.channelId, userId);
    if (!isMember) {
      throw new WsException('FORBIDDEN');
    }
    await socket.join(`channel:${dto.channelId}`);
  }

  @SubscribeMessage('chat:leave')
  async onLeave(
    @ConnectedSocket() socket: Socket & { data: ChatSocketData },
    @MessageBody() dto: ChatRoomDto,
  ): Promise<void> {
    if (!dto?.channelId) {
      throw new WsException('CHANNEL_REQUIRED');
    }
    await socket.leave(`channel:${dto.channelId}`);
  }

  @SubscribeMessage('chat:typing:start')
  async onTypingStart(
    @ConnectedSocket() socket: Socket & { data: ChatSocketData },
    @MessageBody() dto: ChatRoomDto,
  ): Promise<void> {
    return this.broadcastTyping(socket, dto, true);
  }

  @SubscribeMessage('chat:typing:stop')
  async onTypingStop(
    @ConnectedSocket() socket: Socket & { data: ChatSocketData },
    @MessageBody() dto: ChatRoomDto,
  ): Promise<void> {
    return this.broadcastTyping(socket, dto, false);
  }

  private async broadcastTyping(
    socket: Socket & { data: ChatSocketData },
    dto: ChatRoomDto,
    typing: boolean,
  ): Promise<void> {
    const { userId } = socket.data;
    if (!dto?.channelId) {
      throw new WsException('CHANNEL_REQUIRED');
    }
    const isMember = await this.chatService.isMember(dto.channelId, userId);
    if (!isMember) {
      throw new WsException('FORBIDDEN');
    }
    socket.to(`channel:${dto.channelId}`).emit('chat:typing', {
      channelId: dto.channelId,
      userId,
      typing,
    });
  }

  // ── Server → Client (called by ChatListener) ────────────────────────────

  emitToChannel<P>(channelId: string, event: string, payload: P): void {
    if (!this.server) return;
    try {
      this.server.to(`channel:${channelId}`).emit(event, payload);
    } catch (err: unknown) {
      this.logger.error({ event: 'chat.gateway.emit_failed', err });
    }
  }

  private broadcastPresence(
    workspaceId: string,
    userId: string,
    online: boolean,
  ): void {
    if (!this.server) return;
    try {
      this.server
        .to(`workspace:${workspaceId}`)
        .emit('chat:presence', { userId, online });
    } catch (err: unknown) {
      this.logger.error({ event: 'chat.gateway.presence_broadcast_failed', err });
    }
  }
}
