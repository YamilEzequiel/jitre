import { registerAs } from '@nestjs/config';

export type JwtConfig = ReturnType<typeof jwtConfigFactory>;

const jwtConfigFactory = () => ({
  access: {
    secret:
      process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret_change_me_change_me',
    ttl: process.env.JWT_ACCESS_TTL ?? '15m',
  },
  refresh: {
    secret:
      process.env.JWT_REFRESH_SECRET ??
      'dev_refresh_secret_change_me_change_me',
    ttl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  argon2: {
    memoryCost: parseInt(process.env.ARGON2_MEMORY_COST ?? '65536', 10),
    timeCost: parseInt(process.env.ARGON2_TIME_COST ?? '3', 10),
    parallelism: parseInt(process.env.ARGON2_PARALLELISM ?? '4', 10),
  },
});

export const jwtConfig = registerAs('jwt', jwtConfigFactory);
