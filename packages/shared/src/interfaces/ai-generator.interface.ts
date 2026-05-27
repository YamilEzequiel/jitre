import { TaskPriority } from '../enums/task-priority.enum';

/**
 * AI Generator — natural-language → structured draft.
 *
 * The flow is two-step:
 *   1. POST /ai/generate/draft   → returns `AiGenerateDraftResponse` (no DB writes)
 *   2. POST /ai/generate/commit  → caller sends the (possibly edited) draft back,
 *                                  server materializes it via the right service.
 *
 * This split lets the UI show a preview the user can edit before anything is
 * persisted, and keeps a clean audit trail (every commit is an explicit user
 * action, never an LLM hallucination going straight to the DB).
 *
 * v1 supports `task` and `task_with_subtasks`. `doc` and `project` are planned
 * for v2 — see the union to keep the API forward-compatible.
 */

export interface AiTaskDraft {
  kind: 'task';
  /** Required at commit time; the LLM may suggest one from context but the user must confirm. */
  projectId?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority | null;
  /** Free-text labels the LLM extracted; the commit step will match them against existing labels. */
  labels?: string[];
}

export interface AiTaskWithSubtasksDraft {
  kind: 'task_with_subtasks';
  projectId?: string | null;
  parent: {
    title: string;
    description?: string | null;
    priority?: TaskPriority | null;
    labels?: string[];
  };
  subtasks: Array<{
    title: string;
    description?: string | null;
    priority?: TaskPriority | null;
  }>;
}

export interface AiDocDraft {
  kind: 'doc';
  /** Null/undefined → workspace-level wiki page. */
  projectId?: string | null;
  title: string;
  icon?: string | null;
  /** Plain-text body — the commit step wraps it into a Quill Delta. */
  body?: string | null;
}

export interface AiProjectDraft {
  kind: 'project';
  name: string;
  /**
   * Short identifier (3-5 uppercase chars) the user can edit. The LLM proposes
   * one derived from the name; the commit step still validates uniqueness.
   */
  key: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

export type AiGeneratorDraft =
  | AiTaskDraft
  | AiTaskWithSubtasksDraft
  | AiDocDraft
  | AiProjectDraft;

export type AiGeneratorDraftKind = AiGeneratorDraft['kind'];

export interface AiGenerateDraftRequest {
  prompt: string;
  /** Optional anchor — when set, the draft inherits this projectId by default. */
  context?: {
    projectId?: string;
  };
}

export interface AiGenerateDraftResponse {
  drafts: AiGeneratorDraft[];
  /** Provider model that produced the draft, surfaced for transparency. */
  model: string;
  /** USD cost (string to preserve precision). */
  costUsd: string;
}

export interface AiGenerateCommitRequest {
  draft: AiGeneratorDraft;
}

export interface AiGenerateCommitResponse {
  kind: AiGeneratorDraftKind;
  /** Primary entity id (taskId for `task` and parent taskId for `task_with_subtasks`). */
  id: string;
  /** Subtask ids when applicable. */
  childIds?: string[];
}
