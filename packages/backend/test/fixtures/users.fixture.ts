export function createUserFixture(
  overrides: Partial<{ email: string; displayName: string }> = {},
) {
  return {
    email: overrides.email ?? 'test@example.com',
    displayName: overrides.displayName ?? 'Test User',
    plainPassword: 'ValidPass1!Secure',
  };
}
