import type { MongoAbility } from '@casl/ability';

export type Action =
  | 'manage'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'transfer'
  | 'manage_members'
  // Fase 7 — AI + Realtime CASL extensions
  | 'use_ai'
  | 'manage_ai_settings'
  // Fase 8 — Analytics CASL extensions
  | 'read_workspace_analytics'
  | 'read_project_analytics'
  | 'read_ai_analytics_by_user';

export type Subject =
  | 'Workspace'
  | 'WorkspaceMembership'
  | 'User'
  | 'Project'
  | 'ProjectMembership'
  | 'Task'
  | 'Status'
  | 'Label'
  | 'CustomField'
  // Fase 7 — AI subjects
  | 'AiUsageRecord'
  | 'Realtime'
  // Fase 10 — Docs/Wiki
  | 'Document'
  // Fase 10 — Chat
  | 'ChatChannel'
  | 'ChatMessage'
  // Fase 10 — Time Tracking
  | 'TimeEntry'
  | 'all';

export type AppAbility = MongoAbility<[Action, Subject]>;
