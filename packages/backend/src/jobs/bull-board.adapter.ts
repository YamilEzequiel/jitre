import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';

export const BULL_BOARD_BASE_PATH = '/api/v1/admin/queues';

/**
 * Factory that builds a Bull Board Express adapter from BullMQ queues.
 * The returned adapter's router is mounted in main.ts AFTER NestFactory.create,
 * ensuring NestJS middleware (auth + role guards) fires first.
 *
 * Gated by ENABLE_BULL_BOARD env variable.
 */
export function buildBullBoard(queues: Queue[]): ExpressAdapter {
  const adapter = new ExpressAdapter();
  adapter.setBasePath(BULL_BOARD_BASE_PATH);
  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter: adapter,
  });
  return adapter;
}
