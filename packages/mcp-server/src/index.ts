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
  { name: 'jitre-mcp', version: '0.1.1' },
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
