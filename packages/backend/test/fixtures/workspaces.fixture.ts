export function createWorkspaceWithOwner(ownerId: string) {
  return {
    ownerId,
    name: 'Test Workspace',
    slug: 'test-workspace',
  };
}
