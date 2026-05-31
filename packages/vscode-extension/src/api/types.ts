export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  avatarUrl?: string | null;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  workspace: AuthWorkspace;
}

export interface RefreshResponse {
  accessToken: string;
  user: AuthUser;
  workspace: AuthWorkspace | null;
}

export type StatusCategory = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'task' | 'bug' | 'incident' | 'feature';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

export interface ProjectSummary {
  id: string;
  workspaceId?: string;
  key: string;
  name: string;
  description?: string | null;
  status?: 'active' | 'archived' | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectStatus {
  id: string;
  projectId?: string | null;
  workspaceId?: string;
  name: string;
  category: StatusCategory;
  color?: string | null;
  order?: number;
  isDefault?: boolean;
}

export interface TaskSummary {
  id: string;
  projectId: string;
  workspaceId?: string;
  key?: string;
  title: string;
  description?: string | null;
  statusId?: string | null;
  status?: ProjectStatus;
  priority?: TaskPriority;
  type?: TaskType;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedHours?: number | null;
  assigneeUserIds?: string[];
  assignees?: AuthUser[];
  labelIds?: string[];
  parentTaskId?: string | null;
  rank?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  contextType: 'task' | 'document' | 'project';
  contextId: string;
  authorUserId: string;
  author?: AuthUser;
  body: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit?: number;
  pageSize?: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title?: string;
  message?: string;
  readAt?: string | null;
  createdAt: string;
  contextType?: string;
  contextId?: string;
  payload?: Record<string, unknown>;
}

export interface WorkspaceMember {
  id: string;
  userId?: string;
  user?: AuthUser;
  email?: string;
  displayName?: string;
  role?: string;
}

export interface ActiveTimer {
  id: string;
  taskId: string;
  startedAt: string;
  description?: string | null;
  billable?: boolean;
}

export type SearchEntityType =
  | 'comment'
  | 'workspace'
  | 'user'
  | 'task'
  | 'project'
  | 'document';

export interface SearchHit {
  entityType: SearchEntityType;
  entityId: string;
  workspaceId: string;
  rank: number;
  snippet: string;
  occurredAt: string;
  parentType: SearchEntityType | null;
  parentId: string | null;
}

export interface SearchResult {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
}
