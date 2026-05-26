/**
 * AI RBAC E2E
 *
 * Tests CASL use_ai and manage_ai_settings permission enforcement.
 *
 * Requires: live Postgres.
 * Run: POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */

describe.skip('AI RBAC (E2E) — deferred execution', () => {
  it.todo('WORKSPACE_MEMBER can call AI endpoints (use_ai granted)');
  it.todo(
    'WORKSPACE_GUEST cannot call AI endpoints (use_ai not granted) → 403',
  );
  it.todo(
    'WORKSPACE_ADMIN can update ai.daily_budget_usd (manage_ai_settings)',
  );
  it.todo('WORKSPACE_MEMBER cannot update ai.daily_budget_usd → 403');
});
