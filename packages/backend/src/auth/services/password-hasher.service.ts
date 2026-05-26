import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from '@node-rs/argon2';
import type { Algorithm } from '@node-rs/argon2';

// @node-rs/argon2 exposes Algorithm as a const enum (Argon2id = 2). Under
// isolatedModules we can't read const-enum members at runtime, so we hardcode
// the value and rely on `satisfies Algorithm` to type-check.
const ARGON2ID = 2 satisfies Algorithm;

@Injectable()
export class PasswordHasherService {
  constructor(private readonly config: ConfigService) {}

  async hash(password: string): Promise<string> {
    const argon2Config = this.config.get<{
      memoryCost: number;
      timeCost: number;
      parallelism: number;
    }>('jwt');

    return hash(password, {
      algorithm: ARGON2ID,
      memoryCost: argon2Config?.memoryCost ?? 65536,
      timeCost: argon2Config?.timeCost ?? 3,
      parallelism: argon2Config?.parallelism ?? 4,
    });
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    if (!storedHash) return false;
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  }
}
