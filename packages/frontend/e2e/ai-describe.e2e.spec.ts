/**
 * E2E AI Describe Scaffolds
 * Deferred — requires backend Docker harness with AI provider mock.
 */
import { describe, it } from 'vitest';

describe.skip('AI Describe E2E', () => {
  it('clicking AI Describe shows spinner then updates description', async () => {
    // Arrange: task detail open
    // Act: click "AI Describe" button
    // Assert: spinner visible during request, then description updated
  });

  it('AI Describe shows error toast on backend failure', async () => {
    // Arrange: AI backend returns 500
    // Act: click "AI Describe"
    // Assert: error toast shown, description unchanged
  });
});
