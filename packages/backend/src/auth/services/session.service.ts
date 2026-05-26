import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { SessionEntity } from '../session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
  ) {}

  async create(input: {
    userId: string;
    refreshTokenHash: string;
    deviceInfo: object;
    expiresAt: Date;
  }): Promise<SessionEntity> {
    const session = this.sessionRepo.create({
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      deviceInfo: input.deviceInfo as { userAgent: string; ip: string },
      lastUsedAt: new Date(),
      expiresAt: input.expiresAt,
    });
    return this.sessionRepo.save(session);
  }

  async findActiveByHash(hash: string): Promise<SessionEntity | null> {
    return this.sessionRepo.findOne({
      where: {
        refreshTokenHash: hash,
        deletedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async rotate(
    sessionId: string,
    newHash: string,
    newExpiresAt: Date,
  ): Promise<void> {
    const result = await this.sessionRepo.update(sessionId, {
      refreshTokenHash: newHash,
      lastUsedAt: new Date(),
      expiresAt: newExpiresAt,
    });
    if (!result.affected) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessionRepo.softDelete(sessionId);
  }

  async findActiveForUser(userId: string): Promise<SessionEntity[]> {
    return this.sessionRepo.find({
      where: {
        userId,
        deletedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.sessionRepo.softDelete({ userId });
    return result.affected ?? 0;
  }
}
