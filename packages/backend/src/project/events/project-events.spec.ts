import {
  ProjectCreatedEvent,
  ProjectUpdatedEvent,
  ProjectArchivedEvent,
  ProjectDeletedEvent,
  ProjectMemberAddedEvent,
  ProjectMemberRemovedEvent,
  ProjectMemberRoleChangedEvent,
} from './index';

const BASE = {
  aggregateId: 'proj-1',
  aggregateType: 'Project',
  workspaceId: 'ws-1',
  actorUserId: 'user-1',
};

describe('Project domain events', () => {
  describe('ProjectCreatedEvent', () => {
    it('has name "project.created"', () => {
      const e = new ProjectCreatedEvent({
        ...BASE,
        payload: {
          projectId: 'proj-1',
          name: 'My Project',
          key: 'MP',
          ownerUserId: 'user-1',
        },
      });
      expect(e.name).toBe('project.created');
    });

    it('carries payload', () => {
      const e = new ProjectCreatedEvent({
        ...BASE,
        payload: {
          projectId: 'proj-1',
          name: 'My Project',
          key: 'MP',
          ownerUserId: 'user-1',
        },
      });
      expect(e.payload.key).toBe('MP');
    });
  });

  describe('ProjectUpdatedEvent', () => {
    it('has name "project.updated"', () => {
      const e = new ProjectUpdatedEvent({
        ...BASE,
        payload: { projectId: 'proj-1', changes: { name: 'New Name' } },
      });
      expect(e.name).toBe('project.updated');
    });
  });

  describe('ProjectArchivedEvent', () => {
    it('has name "project.archived"', () => {
      const e = new ProjectArchivedEvent({
        ...BASE,
        payload: { projectId: 'proj-1' },
      });
      expect(e.name).toBe('project.archived');
    });
  });

  describe('ProjectDeletedEvent', () => {
    it('has name "project.deleted"', () => {
      const e = new ProjectDeletedEvent({
        ...BASE,
        payload: { projectId: 'proj-1' },
      });
      expect(e.name).toBe('project.deleted');
    });
  });

  describe('ProjectMemberAddedEvent', () => {
    it('has name "project.member.added"', () => {
      const e = new ProjectMemberAddedEvent({
        ...BASE,
        payload: { projectId: 'proj-1', userId: 'user-2', role: 'contributor' },
      });
      expect(e.name).toBe('project.member.added');
    });
  });

  describe('ProjectMemberRemovedEvent', () => {
    it('has name "project.member.removed"', () => {
      const e = new ProjectMemberRemovedEvent({
        ...BASE,
        payload: { projectId: 'proj-1', userId: 'user-2' },
      });
      expect(e.name).toBe('project.member.removed');
    });
  });

  describe('ProjectMemberRoleChangedEvent', () => {
    it('has name "project.member.role_changed"', () => {
      const e = new ProjectMemberRoleChangedEvent({
        ...BASE,
        payload: {
          projectId: 'proj-1',
          userId: 'user-2',
          newRole: 'admin',
          previousRole: 'contributor',
        },
      });
      expect(e.name).toBe('project.member.role_changed');
    });
  });
});
