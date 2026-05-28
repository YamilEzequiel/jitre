import { registerAs } from '@nestjs/config';

export type JwtConfig = ReturnType<typeof jwtConfigFactory>;

function requireSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    // env.validation.ts (Joi) is the primary gate. This is a defense in depth:
    // if config loading is ever bypassed (custom bootstrap, scripts, etc.), we
    // refuse to sign tokens with an undefined / empty secret rather than
    // silently falling back to a public placeholder.
    throw new Error(
      `${name} is not set. Configure it via environment (see env.example).`,
    );
  }
  return value;
}

const jwtConfigFactory = () => ({
  access: {
    secret: requireSecret('JWT_ACCESS_SECRET'),
    ttl: process.env.JWT_ACCESS_TTL ?? '15m',
  },
  refresh: {
    secret: requireSecret('JWT_REFRESH_SECRET'),
    ttl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  argon2: {
    memoryCost: parseInt(process.env.ARGON2_MEMORY_COST ?? '65536', 10),
    timeCost: parseInt(process.env.ARGON2_TIME_COST ?? '3', 10),
    parallelism: parseInt(process.env.ARGON2_PARALLELISM ?? '4', 10),
  },
});

export const jwtConfig = registerAs('jwt', jwtConfigFactory);
