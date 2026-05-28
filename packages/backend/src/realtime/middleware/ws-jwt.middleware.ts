import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import { Socket } from 'socket.io';
import { UserService } from '../../user/user.service';

export interface JwtWsPayload {
  sub: string;
  activeWorkspaceId?: string;
  [key: string]: unknown;
}

interface SocketData {
  userId: string;
  workspaceId: string;
  requestId: string;
}

@Injectable()
export class WsJwtMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly logger: Logger,
  ) {}

  async use(
    socket: Socket & { data: SocketData },
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        return next(new WsException('UNAUTHENTICATED'));
      }

      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) {
        throw new Error(
          'JWT_ACCESS_SECRET not configured for WS auth middleware.',
        );
      }
      const payload = await this.jwtService.verifyAsync<JwtWsPayload>(token, {
        secret,
      });

      const user = await this.userService.findById(payload.sub);
      if (!user || user.deletedAt) {
        return next(new WsException('UNAUTHENTICATED'));
      }

      const workspaceId =
        payload.activeWorkspaceId ??
        (socket.handshake.auth?.workspaceId as string | undefined);
      if (!workspaceId) {
        return next(new WsException('WORKSPACE_REQUIRED'));
      }

      socket.data.userId = user.id;
      socket.data.workspaceId = workspaceId;
      socket.data.requestId = randomUUID();
      next();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn({
        event: 'ws.auth_failed',
        socketId: socket.id,
        err: message,
      });
      next(new WsException('UNAUTHENTICATED'));
    }
  }

  private extractToken(socket: Socket): string | undefined {
    const fromAuth = socket.handshake.auth?.token as unknown;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) {
      return fromAuth;
    }
    const fromHeader = socket.handshake.headers?.authorization as unknown;
    if (typeof fromHeader === 'string' && fromHeader.startsWith('Bearer ')) {
      return fromHeader.slice(7);
    }
    return undefined;
  }
}
