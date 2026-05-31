import * as vscode from 'vscode';

/**
 * Minimal slice of the VS Code git extension API. We type only what we use,
 * to avoid pulling the `@types/vscode-git` package (which doesn't exist as
 * an officially maintained npm package — the API is documented in source).
 */
export interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: {
    readonly HEAD?: { readonly name?: string; readonly commit?: string };
    readonly onDidChange: vscode.Event<void>;
  };
  readonly inputBox: { value: string };
  createBranch(name: string, checkout: boolean, ref?: string): Promise<void>;
  checkout(ref: string): Promise<void>;
}

export interface GitAPI {
  readonly repositories: readonly GitRepository[];
  readonly onDidOpenRepository: vscode.Event<GitRepository>;
  readonly onDidCloseRepository: vscode.Event<GitRepository>;
  getRepository(uri: vscode.Uri): GitRepository | null;
}

interface GitExtension {
  getAPI(version: 1): GitAPI;
}

let cachedApi: GitAPI | null = null;

export async function getGitApi(): Promise<GitAPI | null> {
  if (cachedApi) return cachedApi;
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) return null;
  if (!ext.isActive) await ext.activate();
  cachedApi = ext.exports.getAPI(1);
  return cachedApi;
}

export async function getPrimaryRepository(): Promise<GitRepository | null> {
  const api = await getGitApi();
  if (!api) return null;
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    const match = api.getRepository(folders[0].uri);
    if (match) return match;
  }
  return api.repositories[0] ?? null;
}

export async function getCurrentBranch(): Promise<string | null> {
  const repo = await getPrimaryRepository();
  return repo?.state.HEAD?.name ?? null;
}

/**
 * Extract a Jitre-style task key (e.g. `JIT-123`) from a git branch name.
 * Matches `feat/JIT-123-foo`, `JIT-123`, `bugfix_JIT-123_something`, etc.
 * Returns the first match or null.
 */
export function parseTaskKeyFromBranch(branch: string | null | undefined): string | null {
  if (!branch) return null;
  const match = branch.match(/(?:^|[\/_-])([A-Z][A-Z0-9]{1,9}-\d+)(?:[\/_-]|$)/);
  return match ? match[1] : null;
}

/**
 * Best-effort slug: lowercase, ascii-safe, hyphenated, trimmed to 50 chars.
 * Keeps it usable as a git branch name and as a URL slug.
 */
export function slugify(text: string, max = 50): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

export type BranchKind = 'feat' | 'fix' | 'chore' | 'docs' | 'refactor' | 'test';

export function suggestBranchName(
  kind: BranchKind,
  key: string | null | undefined,
  title: string,
): string {
  const slug = slugify(title);
  if (key) return `${kind}/${key}-${slug}`;
  return `${kind}/${slug}`;
}
