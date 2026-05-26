import { registerAs } from '@nestjs/config';
import { AIProviderName } from '@jitre/shared';

export type AIConfig = ReturnType<typeof aiConfigFactory>;

const aiConfigFactory = () => ({
  provider:
    (process.env.AI_PROVIDER as AIProviderName) ?? AIProviderName.GEMINI,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  },
  budget: {
    monthlyUsd: parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '50'),
  },
  // Fase 7 — rate limits + WebSocket knobs
  maxRequestsPerDay: parseInt(
    process.env.AI_MAX_REQUESTS_PER_DAY ?? '1000',
    10,
  ),
  maxRequestsPerUserPerDay: parseInt(
    process.env.AI_MAX_REQUESTS_PER_USER_PER_DAY ?? '100',
    10,
  ),
  adminBypassUserCap: process.env.AI_ADMIN_BYPASS_USER_CAP !== 'false',
  ws: {
    maxEventsPerSocketSec: parseInt(
      process.env.WS_MAX_EVENTS_PER_SOCKET_SEC ?? '50',
      10,
    ),
    maxRoomsPerSocket: parseInt(
      process.env.WS_MAX_ROOMS_PER_SOCKET ?? '200',
      10,
    ),
    path: process.env.WS_PATH ?? '/ws',
    redisChannelPrefix: process.env.SOCKETIO_REDIS_CHANNEL_PREFIX ?? 'socketio',
  },
});

export const aiConfig = registerAs('ai', aiConfigFactory);
