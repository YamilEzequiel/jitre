/**
 * E2E Command Palette Scaffolds
 * Deferred — requires backend Docker harness.
 */
import { describe, it } from 'vitest';

describe.skip('Command Palette E2E', () => {
  it('Cmd+K opens the palette dialog', async () => {
    // Arrange: logged-in session on dashboard
    // Act: press Cmd+K
    // Assert: dialog role="dialog" is visible
  });

  it('typing a query shows filtered results', async () => {
    // Arrange: palette open
    // Act: type "rep"
    // Assert: results list contains matching items
  });

  it('Enter executes first result and navigates', async () => {
    // Arrange: palette with results
    // Act: ArrowDown once then Enter
    // Assert: URL changed to result target
  });

  it('Escape closes the palette', async () => {
    // Arrange: palette open
    // Act: press Escape
    // Assert: dialog no longer in DOM
  });
});
