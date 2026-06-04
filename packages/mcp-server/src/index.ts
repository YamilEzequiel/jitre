#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { JitreApiClient } from './api-client';

const cfg = {
  baseUrl: process.env.JITRE_API_URL ?? 'http://localhost:3000',
  apiVersion: process.env.JITRE_API_VERSION ?? '1',
  email: process.env.JITRE_EMAIL,
  password: process.env.JITRE_PASSWORD,
  accessToken: process.env.JITRE_ACCESS_TOKEN,
  refreshCookie: process.env.JITRE_REFRESH_COOKIE,
  csrfCookie: process.env.JITRE_CSRF_COOKIE,
};

const client = new JitreApiClient(cfg);

const server = new Server(
  { name: 'jitre-mcp', version: '0.3.0' },
  { capabilities: { tools: {} } },
);

// ───── Tool definitions ─────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'jitre_whoami',
    description: 'Return the signed-in user and active workspace.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'jitre_list_workspaces',
    description: 'List workspaces the user belongs to.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'jitre_list_projects',
    description: 'List projects in the current workspace.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'jitre_get_project',
    description: 'Fetch a single project by id.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_list_project_statuses',
    description: 'List workflow statuses for a project.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_list_tasks',
    description:
      'List tasks in a project. Optional filters by status, assignee, free-text query. Each task includes `assignees[]` with { userId, displayName, email, avatarUrl } so callers can render the assigned user by NAME — never by raw userId. The legacy `assigneeUserIds[]` is also returned for backward compatibility.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        statusId: { type: 'string' },
        assigneeUserId: { type: 'string' },
        q: { type: 'string' },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_get_task',
    description:
      'Fetch a task by id. The response includes `assignees[]` with { userId, displayName, email, avatarUrl } so callers can display the assigned user by NAME instead of UUID. `assigneeUserIds[]` is kept for backward compatibility.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_create_task',
    description:
      'Create a task in a project. If statusId is omitted, the project default status is used (matches the Jitre UI behavior). parentTaskId converts it into a subtask.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: {
          type: 'string',
          enum: ['none', 'low', 'medium', 'high', 'urgent'],
        },
        statusId: { type: 'string' },
        parentTaskId: { type: 'string' },
        assigneeUserIds: { type: 'array', items: { type: 'string' } },
        dueDate: { type: 'string', description: 'ISO date string' },
      },
      required: ['projectId', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_update_task',
    description: 'Patch a task (title, description, priority, due date, assignees).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        taskId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: {
          type: 'string',
          enum: ['none', 'low', 'medium', 'high', 'urgent'],
        },
        dueDate: { type: ['string', 'null'] },
        assigneeUserIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['projectId', 'taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_change_task_status',
    description: 'Change the status of a task.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        taskId: { type: 'string' },
        statusId: { type: 'string' },
      },
      required: ['projectId', 'taskId', 'statusId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_complete_task',
    description: 'Shortcut to mark a task as done (uses the first DONE-category status).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        taskId: { type: 'string' },
      },
      required: ['projectId', 'taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_assign_task',
    description: 'Assign a user to a task.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        taskId: { type: 'string' },
        userId: { type: 'string' },
      },
      required: ['projectId', 'taskId', 'userId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_list_comments',
    description: 'List comments for a task.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_add_comment',
    description: 'Add a comment to a task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['taskId', 'body'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_search',
    description:
      'Full-text search across the workspace. type=task is the most common entry point.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        type: {
          type: 'string',
          enum: ['task', 'project', 'comment', 'document', 'user', 'workspace'],
        },
        pageSize: { type: 'number' },
      },
      required: ['q'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_start_timer',
    description:
      'Start a timer for a task. Auto-stops any currently running timer for the same user (only one active timer per user is allowed).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        description: { type: 'string' },
        billable: { type: 'boolean' },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_stop_timer',
    description:
      'Stop the current user\'s active timer. Returns the resulting time entry. Errors with NO_ACTIVE_TIMER if none is running.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'jitre_get_active_timer',
    description:
      'Return the current user\'s active timer, or null if none is running.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'jitre_log_time',
    description:
      'Create a manual time entry on a task. durationMinutes is 0-1440 (one day max). date is an ISO date (YYYY-MM-DD). billable defaults to true.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        durationMinutes: { type: 'number', minimum: 0, maximum: 1440 },
        date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        description: { type: 'string' },
        billable: { type: 'boolean' },
      },
      required: ['taskId', 'durationMinutes', 'date'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_list_time_entries',
    description:
      'List time entries. Non-admin callers only see their own entries; admins can filter by userId. Supports filtering by task, project, date range, and billable flag.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        taskId: { type: 'string' },
        projectId: { type: 'string' },
        dateFrom: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        dateTo: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        billable: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_update_time_entry',
    description:
      'Patch a time entry. Only the owner or an admin can update. Pass only the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        timeEntryId: { type: 'string' },
        durationMinutes: { type: 'number', minimum: 0, maximum: 1440 },
        date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        description: { type: ['string', 'null'] },
        billable: { type: 'boolean' },
      },
      required: ['timeEntryId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_delete_time_entry',
    description: 'Delete a time entry. Only the owner or an admin can delete.',
    inputSchema: {
      type: 'object',
      properties: { timeEntryId: { type: 'string' } },
      required: ['timeEntryId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_task_time_summary',
    description:
      'Summary of tracked time for a task: total minutes plus the list of entries visible to the caller (own entries unless admin).',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_list_test_cases',
    description:
      'List structured test cases (Given/When/Then) for a task. Each case has title, precondition, steps, expected, status (pending|passed|failed|blocked|skipped), and trazabilidad fields (completedByUserId, completedAt).',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_create_test_case',
    description:
      'Create a structured test case on a task. `title` required; `precondition` / `steps` / `expected` are optional plain text (markdown allowed). New cases start in `pending`.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
        precondition: { type: 'string' },
        steps: { type: 'string' },
        expected: { type: 'string' },
        order: { type: 'number', minimum: 0 },
      },
      required: ['taskId', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_update_test_case',
    description:
      'Patch a test case. Pass only the fields to change. Send `null` on a text field to clear it.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        testCaseId: { type: 'string' },
        title: { type: 'string' },
        precondition: { type: ['string', 'null'] },
        steps: { type: ['string', 'null'] },
        expected: { type: ['string', 'null'] },
      },
      required: ['taskId', 'testCaseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_set_test_case_status',
    description:
      'Change the status of a test case. Stamps completedByUserId + completedAt when leaving `pending`; clears them when reset to `pending`.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        testCaseId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['pending', 'passed', 'failed', 'blocked', 'skipped'],
        },
      },
      required: ['taskId', 'testCaseId', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_reorder_test_cases',
    description:
      'Reorder test cases inside a task. `orderedIds` must include every (non-deleted) case belonging to the task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        orderedIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['taskId', 'orderedIds'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_delete_test_case',
    description: 'Soft-delete a test case.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        testCaseId: { type: 'string' },
      },
      required: ['taskId', 'testCaseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_suggest_test_cases',
    description:
      'Ask the backend AI to propose structured test cases for a task. Default: return suggestions only. Set `apply=true` to also persist them on the task; the response includes the `created` array in that case.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        maxSuggestions: { type: 'number', minimum: 1, maximum: 15 },
        apply: { type: 'boolean' },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'jitre_time_report',
    description:
      'Aggregated time report grouped by user, project, task, or date. Non-admins are scoped to their own entries; admins can filter by userId/projectId. dateFrom and dateTo are required ISO dates.',
    inputSchema: {
      type: 'object',
      properties: {
        groupBy: { type: 'string', enum: ['user', 'project', 'task', 'date'] },
        dateFrom: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        dateTo: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        userId: { type: 'string' },
        projectId: { type: 'string' },
      },
      required: ['groupBy', 'dateFrom', 'dateTo'],
      additionalProperties: false,
    },
  },
] as const;

// ───── Tool handler ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS as unknown as object[] }));

const StringSchema = z.string();

interface ProjectStatus {
  id: string;
  isDefault?: boolean;
  order?: number;
}

async function resolveDefaultStatusId(projectId: string): Promise<string> {
  const statuses = await client.request<ProjectStatus[]>(
    `/projects/${projectId}/statuses`,
  );
  if (!Array.isArray(statuses) || statuses.length === 0) {
    throw new Error(
      `Project ${projectId} has no statuses configured. Create at least one status before creating tasks.`,
    );
  }
  const explicit = statuses.find((s) => s.isDefault === true);
  if (explicit) return explicit.id;
  const sorted = [...statuses].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  return sorted[0].id;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  try {
    let payload: unknown;
    switch (name) {
      case 'jitre_whoami': {
        await client.ensureSession();
        payload = { user: client.getUser(), workspace: client.getWorkspace() };
        break;
      }
      case 'jitre_list_workspaces':
        payload = await client.request('/workspaces');
        break;
      case 'jitre_list_projects':
        payload = await client.request('/projects');
        break;
      case 'jitre_get_project': {
        const projectId = StringSchema.parse(args.projectId);
        payload = await client.request(`/projects/${projectId}`);
        break;
      }
      case 'jitre_list_project_statuses': {
        const projectId = StringSchema.parse(args.projectId);
        payload = await client.request(`/projects/${projectId}/statuses`);
        break;
      }
      case 'jitre_list_tasks': {
        const projectId = StringSchema.parse(args.projectId);
        const qs = new URLSearchParams();
        if (typeof args.statusId === 'string') qs.set('statusId', args.statusId);
        if (typeof args.assigneeUserId === 'string')
          qs.set('assigneeUserId', args.assigneeUserId);
        if (typeof args.q === 'string') qs.set('q', args.q);
        const query = qs.toString();
        payload = await client.request(
          `/projects/${projectId}/tasks${query ? `?${query}` : ''}`,
        );
        break;
      }
      case 'jitre_get_task': {
        const taskId = StringSchema.parse(args.taskId);
        payload = await client.request(`/tasks/${taskId}`);
        break;
      }
      case 'jitre_create_task': {
        const projectId = StringSchema.parse(args.projectId);
        const statusId =
          typeof args.statusId === 'string'
            ? args.statusId
            : await resolveDefaultStatusId(projectId);
        const body = {
          title: args.title,
          description: args.description,
          priority: args.priority,
          statusId,
          parentTaskId: args.parentTaskId,
          assigneeUserIds: args.assigneeUserIds,
          dueDate: args.dueDate,
        };
        payload = await client.request(`/projects/${projectId}/tasks`, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_update_task': {
        const projectId = StringSchema.parse(args.projectId);
        const taskId = StringSchema.parse(args.taskId);
        const patch: Record<string, unknown> = {};
        for (const k of ['title', 'description', 'priority', 'dueDate', 'assigneeUserIds']) {
          if (args[k] !== undefined) patch[k] = args[k];
        }
        payload = await client.request(`/projects/${projectId}/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_change_task_status': {
        const projectId = StringSchema.parse(args.projectId);
        const taskId = StringSchema.parse(args.taskId);
        const statusId = StringSchema.parse(args.statusId);
        payload = await client.request(`/projects/${projectId}/tasks/${taskId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ statusId }),
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_complete_task': {
        const projectId = StringSchema.parse(args.projectId);
        const taskId = StringSchema.parse(args.taskId);
        payload = await client.request(`/projects/${projectId}/tasks/${taskId}/complete`, {
          method: 'POST',
          body: '{}',
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_assign_task': {
        const projectId = StringSchema.parse(args.projectId);
        const taskId = StringSchema.parse(args.taskId);
        const userId = StringSchema.parse(args.userId);
        payload = await client.request(`/projects/${projectId}/tasks/${taskId}/assignees`, {
          method: 'POST',
          body: JSON.stringify({ userId }),
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_list_comments': {
        const taskId = StringSchema.parse(args.taskId);
        const qs = new URLSearchParams({
          contextType: 'task',
          contextId: taskId,
          page: '1',
          limit: '100',
        });
        payload = await client.request(`/comments?${qs.toString()}`);
        break;
      }
      case 'jitre_add_comment': {
        const taskId = StringSchema.parse(args.taskId);
        const body = StringSchema.parse(args.body);
        payload = await client.request('/comments', {
          method: 'POST',
          body: JSON.stringify({ contextType: 'task', contextId: taskId, body }),
          headers: {
            'content-type': 'application/json',
            'x-jitre-source': 'mcp',
          },
        });
        break;
      }
      case 'jitre_search': {
        const q = StringSchema.parse(args.q);
        const qs = new URLSearchParams({ q, page: '1' });
        if (typeof args.type === 'string') qs.set('type', args.type);
        qs.set('pageSize', String(typeof args.pageSize === 'number' ? args.pageSize : 20));
        payload = await client.request(`/search?${qs.toString()}`);
        break;
      }
      case 'jitre_start_timer': {
        const taskId = StringSchema.parse(args.taskId);
        const body: Record<string, unknown> = { taskId };
        if (typeof args.description === 'string') body.description = args.description;
        if (typeof args.billable === 'boolean') body.billable = args.billable;
        payload = await client.request('/time-entries/timer/start', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_stop_timer': {
        payload = await client.request('/time-entries/timer/stop', {
          method: 'POST',
          body: '{}',
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_get_active_timer': {
        payload = await client.request('/time-entries/timer/active');
        break;
      }
      case 'jitre_log_time': {
        const taskId = StringSchema.parse(args.taskId);
        const date = StringSchema.parse(args.date);
        if (typeof args.durationMinutes !== 'number') {
          throw new Error('durationMinutes must be a number');
        }
        const body: Record<string, unknown> = {
          taskId,
          durationMinutes: args.durationMinutes,
          date,
        };
        if (typeof args.description === 'string') body.description = args.description;
        if (typeof args.billable === 'boolean') body.billable = args.billable;
        payload = await client.request('/time-entries', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_list_time_entries': {
        const qs = new URLSearchParams();
        if (typeof args.userId === 'string') qs.set('userId', args.userId);
        if (typeof args.taskId === 'string') qs.set('taskId', args.taskId);
        if (typeof args.projectId === 'string') qs.set('projectId', args.projectId);
        if (typeof args.dateFrom === 'string') qs.set('dateFrom', args.dateFrom);
        if (typeof args.dateTo === 'string') qs.set('dateTo', args.dateTo);
        if (typeof args.billable === 'boolean') qs.set('billable', String(args.billable));
        const query = qs.toString();
        payload = await client.request(`/time-entries${query ? `?${query}` : ''}`);
        break;
      }
      case 'jitre_update_time_entry': {
        const timeEntryId = StringSchema.parse(args.timeEntryId);
        const patch: Record<string, unknown> = {};
        for (const k of ['durationMinutes', 'date', 'description', 'billable']) {
          if (args[k] !== undefined) patch[k] = args[k];
        }
        payload = await client.request(`/time-entries/${timeEntryId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_delete_time_entry': {
        const timeEntryId = StringSchema.parse(args.timeEntryId);
        await client.request(`/time-entries/${timeEntryId}`, { method: 'DELETE' });
        payload = { deleted: true, id: timeEntryId };
        break;
      }
      case 'jitre_task_time_summary': {
        const taskId = StringSchema.parse(args.taskId);
        payload = await client.request(`/tasks/${taskId}/time-summary`);
        break;
      }
      case 'jitre_list_test_cases': {
        const taskId = StringSchema.parse(args.taskId);
        payload = await client.request(`/tasks/${taskId}/test-cases`);
        break;
      }
      case 'jitre_create_test_case': {
        const taskId = StringSchema.parse(args.taskId);
        const title = StringSchema.parse(args.title);
        const body: Record<string, unknown> = { title };
        if (typeof args.precondition === 'string') body.precondition = args.precondition;
        if (typeof args.steps === 'string') body.steps = args.steps;
        if (typeof args.expected === 'string') body.expected = args.expected;
        if (typeof args.order === 'number') body.order = args.order;
        payload = await client.request(`/tasks/${taskId}/test-cases`, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        });
        break;
      }
      case 'jitre_update_test_case': {
        const taskId = StringSchema.parse(args.taskId);
        const testCaseId = StringSchema.parse(args.testCaseId);
        const patch: Record<string, unknown> = {};
        for (const k of ['title', 'precondition', 'steps', 'expected']) {
          if (args[k] !== undefined) patch[k] = args[k];
        }
        payload = await client.request(
          `/tasks/${taskId}/test-cases/${testCaseId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(patch),
            headers: { 'content-type': 'application/json' },
          },
        );
        break;
      }
      case 'jitre_set_test_case_status': {
        const taskId = StringSchema.parse(args.taskId);
        const testCaseId = StringSchema.parse(args.testCaseId);
        const status = StringSchema.parse(args.status);
        payload = await client.request(
          `/tasks/${taskId}/test-cases/${testCaseId}/status`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status }),
            headers: { 'content-type': 'application/json' },
          },
        );
        break;
      }
      case 'jitre_reorder_test_cases': {
        const taskId = StringSchema.parse(args.taskId);
        if (!Array.isArray(args.orderedIds)) {
          throw new Error('orderedIds must be an array');
        }
        await client.request(`/tasks/${taskId}/test-cases/reorder`, {
          method: 'POST',
          body: JSON.stringify({ orderedIds: args.orderedIds }),
          headers: { 'content-type': 'application/json' },
        });
        payload = { reordered: true, count: args.orderedIds.length };
        break;
      }
      case 'jitre_delete_test_case': {
        const taskId = StringSchema.parse(args.taskId);
        const testCaseId = StringSchema.parse(args.testCaseId);
        await client.request(`/tasks/${taskId}/test-cases/${testCaseId}`, {
          method: 'DELETE',
        });
        payload = { deleted: true, id: testCaseId };
        break;
      }
      case 'jitre_suggest_test_cases': {
        const taskId = StringSchema.parse(args.taskId);
        const body: Record<string, unknown> = {};
        if (typeof args.maxSuggestions === 'number')
          body.maxSuggestions = args.maxSuggestions;
        if (typeof args.apply === 'boolean') body.apply = args.apply;
        payload = await client.request(
          `/ai/tasks/${taskId}/suggest-test-cases`,
          {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json' },
          },
        );
        break;
      }
      case 'jitre_time_report': {
        const groupBy = StringSchema.parse(args.groupBy);
        const dateFrom = StringSchema.parse(args.dateFrom);
        const dateTo = StringSchema.parse(args.dateTo);
        const qs = new URLSearchParams({ groupBy, dateFrom, dateTo });
        if (typeof args.userId === 'string') qs.set('userId', args.userId);
        if (typeof args.projectId === 'string') qs.set('projectId', args.projectId);
        payload = await client.request(`/time-entries/report?${qs.toString()}`);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(payload, null, 2) },
      ],
    };
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error: ${(err as Error).message}`,
        },
      ],
    };
  }
});

// ───── Boot ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('jitre-mcp-server connected via stdio\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
