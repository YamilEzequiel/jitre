/**
 * Single source of truth for app version, repo, and license info.
 *
 * APP_VERSION must be bumped in lockstep with package.json (root + frontend).
 * The /changelog page reads CHANGELOG.md from the build output; the version
 * line in the footer reads APP_VERSION below.
 */
export const APP_VERSION = '0.1.0';

export const REPO_URL = 'https://github.com/YamilEzequiel/jitre';
export const REPO_ISSUES_URL = `${REPO_URL}/issues`;
export const REPO_RELEASES_URL = `${REPO_URL}/releases`;

export const LICENSE_NAME = 'PolyForm Noncommercial 1.0.0';
export const LICENSE_URL = 'https://polyformproject.org/licenses/noncommercial/1.0.0';
