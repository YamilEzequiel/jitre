/**
 * E2E Task Lifecycle Scaffolds
 * Deferred — requires backend Docker harness.
 */
import { describe, it } from 'vitest';

describe.skip('Task Create/Update Lifecycle E2E', () => {
  it('create task via task form and see it in list', async () => {
    // Arrange: project exists
    // Act: open create task dialog, fill title, submit
    // Assert: new task card appears in list with correct title
  });

  it('edit task title inline (optimistic)', async () => {
    // Arrange: task in list
    // Act: click title to edit, type new text, press Enter
    // Assert: title updates immediately (optimistic), then confirms
  });

  it('change task status updates status chip', async () => {
    // Arrange: task detail open
    // Act: select new status from dropdown
    // Assert: status chip updates
  });

  it('rollback on API error — title reverts', async () => {
    // Arrange: network offline / API returns 500
    // Act: edit task title, press Enter
    // Assert: toast shows, title reverts to original
  });
});
