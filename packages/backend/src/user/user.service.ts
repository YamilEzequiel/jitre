import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { UserEntity } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserEntity> {
    const user = this.userRepo.create(input);
    try {
      return await this.userRepo.save(user);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException('EMAIL_TAKEN');
      }
      throw err;
    }
  }

  async updateLastLoginAt(id: string): Promise<void> {
    await this.userRepo.update(id, { lastLoginAt: new Date() });
  }

  async updateProfile(
    id: string,
    patch: { displayName?: string; email?: string },
  ): Promise<UserEntity> {
    try {
      await this.userRepo.update(id, patch);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException('EMAIL_TAKEN');
      }
      throw err;
    }
    const updated = await this.userRepo.findOne({ where: { id } });
    if (!updated) throw new ConflictException('USER_NOT_FOUND');
    return updated;
  }
}
