/**
 * Stable sentinel user id used as the "actor" for actions taken by the
 * platform itself rather than a human user — cron schedulers, system
 * migrations, AI proactive features. Used as `user_id` on audit /
 * usage / activity rows so the source can be filtered out of analytics
 * that should reflect human behaviour only.
 *
 * The id is a fixed UUID with a distinctive shape ("jitre" + zero
 * padding) so it's easy to spot in raw SQL and never collides with a
 * real user UUID. It is NOT a row in the `users` table — there is no
 * FK constraint from audit / usage tables to `users` precisely so that
 * a sentinel id can flow through without orphaned-FK violations.
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-5000-000000515721'; // 'JITRE' in trailing hex
export const SYSTEM_USER_LABEL = 'jitre-system';

/** Convenience predicate — handy in analytics queries and log filters. */
export function isSystemUser(userId: string | null | undefined): boolean {
  return userId === SYSTEM_USER_ID;
}
