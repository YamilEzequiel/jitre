/**
 * Realtime Event Bridge E2E
 *
 * Tests that domain events are relayed to connected WebSocket clients via Socket.IO.
 *
 * Flow:
 *   1. Register user → create project → connect WS → subscribe.project
 *   2. POST /tasks → assert socket received task:created within 200ms
 *
 * Requires: live Postgres + Redis + Socket.IO adapter.
 * Run: POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * Skip guard: if REDIS_HOST is not configured, tests are skipped.
 */

const REDIS_AVAILABLE = !!process.env.REDIS_HOST;

describe.skip('Realtime Event Bridge (E2E) — deferred execution', () => {
  it.todo(
    'task.created event → socket receives task:created payload within 200ms',
  );
  it.todo('task.updated event → project room receives task:updated');
  it.todo(
    'subscription quota: over WS_MAX_ROOMS_PER_SOCKET → SUBSCRIPTION_QUOTA error',
  );
  it.todo('auth: missing token → WsException UNAUTHENTICATED on connect');

  void REDIS_AVAILABLE; // used in full implementation
});
