import { TestBed } from '@angular/core/testing';
import { ProjectStore } from './project.store';
import { ProjectApiService, Project } from './project-api.service';

const projects: Project[] = [
  { id: 'p1', name: 'Project 1', key: 'P1', status: 'active', workspaceId: 'ws1' },
  { id: 'p2', name: 'Project 2', key: 'P2', status: 'archived', workspaceId: 'ws1' },
];

describe('ProjectStore', () => {
  let store: ProjectStore;
  const mockProjectApi = {
    getById: vi.fn(),
    list: vi.fn().mockResolvedValue(projects),
    create: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProjectStore,
        { provide: ProjectApiService, useValue: mockProjectApi },
      ],
    });
    store = TestBed.inject(ProjectStore);
    store.load(projects);
  });

  it('byId computed returns entity by id', () => {
    expect(store.byId()['p1']?.name).toBe('Project 1');
  });

  it('workspace switch clears and reloads projects', async () => {
    expect(store.items()).toHaveLength(2);
    await store.onWorkspaceSwitch('ws2');
    expect(mockProjectApi.list).toHaveBeenCalledWith('ws2');
  });
});
