import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { WorkspaceRole, ProjectRole } from '@jitre/shared';
import type { AppAbility, Subject } from './ability.types';

@Injectable()
export class CaslAbilityFactory {
  createForUserInWorkspace(
    userId: string,
    workspaceId: string,
    role: WorkspaceRole,
  ): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (role === WorkspaceRole.OWNER) {
      can('manage', 'all');
      can('transfer', 'Workspace');
      can('use_ai', 'Workspace');
      can('manage_ai_settings', 'Workspace');
      can('read', 'AiUsageRecord');
      // Fase 8 — Analytics
      can('read_workspace_analytics', 'Workspace');
      can('read_ai_analytics_by_user', 'Workspace');
    } else if (role === WorkspaceRole.ADMIN) {
      can('manage', 'all');
      cannot('transfer', 'Workspace');
      cannot('delete', 'Workspace');
      can('use_ai', 'Workspace');
      can('manage_ai_settings', 'Workspace');
      can('read', 'AiUsageRecord');
      // Fase 8 — Analytics
      can('read_workspace_analytics', 'Workspace');
      can('read_ai_analytics_by_user', 'Workspace');
    } else if (role === WorkspaceRole.MEMBER) {
      can('read', 'all');
      can('create', 'all');
      can('use_ai', 'Workspace');
      // Fase 8 — Analytics (MEMBER = WORKSPACE_VIEWER+)
      can('read_workspace_analytics', 'Workspace');
      // Fase 10 — Docs/Wiki: members get full CRUD on workspace-scoped docs.
      // (Project-scoped docs still go through createForUserInProject.)
      can('update', 'Document');
      can('delete', 'Document');
      // Fase 10 — Chat: members can read channels they're in and update/delete
      // their own messages. Channel CRUD beyond create is gated at the service
      // level (creator/admin checks on channels, author/admin on messages).
      can('update', 'ChatMessage', { authorId: userId });
      can('delete', 'ChatMessage', { authorId: userId });
      can('update', 'ChatChannel', { createdByUserId: userId });
      can('delete', 'ChatChannel', { createdByUserId: userId });
      // Fase 10 — Time Tracking: members can log + mutate their OWN entries.
      // Cross-user visibility & reports are reserved for workspace admins
      // (the 'manage all' grant in OWNER/ADMIN above covers that).
      can('read', 'TimeEntry', { userId });
      can('create', 'TimeEntry');
      can('update', 'TimeEntry', { userId });
      can('delete', 'TimeEntry', { userId });
    } else if (role === WorkspaceRole.GUEST) {
      can('read', 'all');
      // Fase 8 — Analytics (GUEST = WORKSPACE_VIEWER+)
      can('read_workspace_analytics', 'Workspace');
      // Fase 10 — Docs/Wiki: guests are read-only.
      // Fase 10 — Chat: guests are read-only as well.
      // Fase 10 — Time Tracking: guests can read their own entries but
      // cannot log time (typical "external collaborator" semantics).
      can('read', 'TimeEntry', { userId });
    }

    void userId;
    void workspaceId;

    return build({
      detectSubjectType: (item) =>
        (item as { constructor: { name: string } }).constructor.name as Subject,
    });
  }

  /**
   * Project-scoped ability factory.
   * ADR-1: Layered approach — workspace role checked first; project role layered on top.
   * Workspace OWNER/ADMIN always win (full manage). Otherwise, project role determines access.
   */
  createForUserInProject(
    userId: string,
    workspaceId: string,
    projectId: string,
    workspaceRole: WorkspaceRole,
    projectRole: ProjectRole | undefined,
  ): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // Workspace OWNER/ADMIN always win
    if (
      workspaceRole === WorkspaceRole.OWNER ||
      workspaceRole === WorkspaceRole.ADMIN
    ) {
      can('manage', 'all');
    } else if (projectRole === ProjectRole.ADMIN) {
      // Project ADMIN — manage all project-scoped subjects + members
      can('manage', 'Task');
      can('manage', 'Status');
      can('manage', 'Label');
      can('manage', 'CustomField');
      can('manage', 'ProjectMembership');
      can('manage', 'Project');
      can('manage_members', 'Project');
      can('read', 'all');
      // Fase 8 — Analytics
      can('read_project_analytics', 'Project');
      // Fase 10 — Docs/Wiki
      can('manage', 'Document');
      // Fase 10 — Time Tracking: project admins manage every entry in the project.
      can('manage', 'TimeEntry');
    } else if (projectRole === ProjectRole.CONTRIBUTOR) {
      // Project CONTRIBUTOR — create + update/delete own tasks (V4 fix); read all
      can('create', 'Task');
      can('read', 'Task');
      // V4: scoped to own tasks (creatorUserId === userId)
      can('update', 'Task', { creatorUserId: userId });
      can('delete', 'Task', { creatorUserId: userId });
      can('read', 'Status');
      can('read', 'Label');
      can('read', 'CustomField');
      can('read', 'Project');
      // Fase 8 — Analytics
      can('read_project_analytics', 'Project');
      // Fase 10 — Docs/Wiki — contributors can create + edit own docs.
      can('create', 'Document');
      can('read', 'Document');
      can('update', 'Document', { creatorUserId: userId });
      can('delete', 'Document', { creatorUserId: userId });
      // Fase 10 — Time Tracking: contributors log time + manage their own.
      can('read', 'TimeEntry', { userId });
      can('create', 'TimeEntry');
      can('update', 'TimeEntry', { userId });
      can('delete', 'TimeEntry', { userId });
    } else if (projectRole === ProjectRole.VIEWER) {
      // Project VIEWER — read only
      can('read', 'Task');
      can('read', 'Status');
      can('read', 'Label');
      can('read', 'CustomField');
      can('read', 'Project');
      // Fase 8 — Analytics
      can('read_project_analytics', 'Project');
      // Fase 10 — Docs/Wiki — viewers can only read docs.
      can('read', 'Document');
      // Fase 10 — Time Tracking — viewers can read only their own entries,
      // no create/update/delete (mirrors workspace GUEST policy).
      can('read', 'TimeEntry', { userId });
    }
    // No project membership — no abilities granted

    void userId;
    void workspaceId;
    void projectId;

    return build({
      detectSubjectType: (item) =>
        (item as { constructor: { name: string } }).constructor.name as Subject,
    });
  }
}
