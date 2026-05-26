/**
 * AI Describe E2E
 *
 * Tests POST /api/v1/ai/tasks/:id/describe end-to-end.
 *
 * Flow:
 *   1. Seed: workspace, user, project, task
 *   2. POST /ai/tasks/:id/describe (mocked Gemini SDK)
 *   3. Assert: task.description updated + AiUsageRecord row written + ai.request_made audit row
 *
 * Requires: live Postgres. Gemini SDK is mocked via jest module mock.
 * Run: POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */

describe.skip('AI Describe (E2E) — deferred execution', () => {
  it.todo('POST /ai/tasks/:id/describe → 200 with description + usage');
  it.todo('applies description to task when applyToTask=true (default)');
  it.todo('does not update task when applyToTask=false');
  it.todo('AiUsageRecord row written with success=true');
  it.todo('ai.request_made audit row written');
});
