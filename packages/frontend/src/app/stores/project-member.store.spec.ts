import { TestBed } from '@angular/core/testing';
import { ProjectMemberStore } from './project-member.store';
import { ProjectMemberApiService, ProjectMember } from './project-member-api.service';

const members: ProjectMember[] = [
  { id: 'm1', workspaceId: 'ws1', projectId: 'p1', userId: 'u1', role: 'admin', assignedAt: '2024-01-01' },
  { id: 'm2', workspaceId: 'ws1', projectId: 'p1', userId: 'u2', role: 'contributor', assignedAt: '2024-01-02' },
  { id: 'm3', workspaceId: 'ws1', projectId: 'p2', userId: 'u1', role: 'viewer', assignedAt: '2024-01-03' },
];

describe('ProjectMemberStore', () => {
  let store: ProjectMemberStore;
  const apiMock = {
    listByProject: vi.fn().mockResolvedValue([members[0], members[1]]),
  };

  beforeEach(() => {
    apiMock.listByProject.mockClear();
    apiMock.listByProject.mockResolvedValue([members[0], members[1]]);
    TestBed.configureTestingModule({
      providers: [
        ProjectMemberStore,
        { provide: ProjectMemberApiService, useValue: apiMock },
      ],
    });
    store = TestBed.inject(ProjectMemberStore);
    store.load(members);
  });

  it('byProject returns members for that project', () => {
    expect(store.byProject('p1')().map(m => m.id).sort()).toEqual(['m1', 'm2']);
  });

  it('loadForProject calls api and replaces project slice', async () => {
    await store.loadForProject('p1');
    expect(apiMock.listByProject).toHaveBeenCalledWith('p1');
    // p2 member should still be in the store
    expect(store.byProject('p2')().length).toBe(1);
  });
});
