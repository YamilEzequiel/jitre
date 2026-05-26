/**
 * AI Quota E2E
 *
 * Tests that the AiQuotaGuard enforces workspace budget and returns 429.
 *
 * Flow:
 *   1. Seed AiUsageRecord rows summing to ai.daily_budget_usd
 *   2. POST /ai/tasks/:id/describe → expect 429 AI_BUDGET_EXCEEDED
 *   3. Assert ai.budget_exceeded audit row
 *
 * Requires: live Postgres.
 * Run: POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */

describe.skip('AI Quota Guard (E2E) — deferred execution', () => {
  it.todo('returns 429 AI_BUDGET_EXCEEDED when daily budget is exhausted');
  it.todo('returns 429 AI_RATE_LIMIT_HIT when user daily request cap exceeded');
  it.todo(
    'workspace admin bypasses user cap when AI_ADMIN_BYPASS_USER_CAP=true',
  );
  it.todo('ai.budget_exceeded audit row written on 429 response');
});
