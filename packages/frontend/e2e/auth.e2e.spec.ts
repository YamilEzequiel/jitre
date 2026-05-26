/**
 * E2E Auth Flow Scaffolds
 * Deferred — requires backend Docker harness (no local backend in CI yet).
 * These specs use describe.skip; un-skip when Playwright + backend are available.
 */
import { describe, it } from 'vitest';

describe.skip('Auth E2E', () => {
  it('register redirects to dashboard', async () => {
    // Arrange: open /register
    // Act: fill form + submit
    // Assert: URL becomes / (dashboard)
  });

  it('login with valid credentials navigates to dashboard', async () => {
    // Arrange: existing user in DB
    // Act: fill /login form
    // Assert: URL becomes /
  });

  it('logout redirects to /login', async () => {
    // Arrange: logged-in session
    // Act: click logout
    // Assert: URL becomes /login
  });

  it('unauthenticated access to /projects redirects to /login', async () => {
    // Arrange: clear session storage / cookies
    // Act: navigate to /projects
    // Assert: URL becomes /login
  });
});
