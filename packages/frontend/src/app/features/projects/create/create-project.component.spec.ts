import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { CreateProjectComponent } from './create-project.component';
import { ProjectApiService } from '../../../stores/project-api.service';
import { AreaStore } from '../../../stores/area.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ReactiveFormsModule } from '@angular/forms';

describe('CreateProjectComponent', () => {
  let fixture: ComponentFixture<CreateProjectComponent>;
  let apiMock: { create: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = { create: vi.fn().mockResolvedValue({ id: 'new-id', name: 'Test', key: 'TEST', status: 'active', workspaceId: 'ws1' }) };
    toastMock = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ProjectApiService, useValue: apiMock },
        { provide: ToastService, useValue: toastMock },
        {
          provide: AreaStore,
          useValue: {
            areas: signal([]).asReadonly(),
            byId: signal({} as Record<string, unknown>).asReadonly(),
            load: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentWorkspace: signal({ id: 'ws1', name: 'WS', slug: 'ws', role: 'admin' }).asReadonly(),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(CreateProjectComponent);
    fixture.componentRef.setInput('workspaceId', 'ws1');
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('submit calls api.create with form values', async () => {
    const comp = fixture.componentInstance;
    comp.form.setValue({
      name: 'My Project',
      key: 'MYPROJ',
      description: '',
      color: '#4f46e5',
      icon: '',
      startDate: '',
      targetDate: '',
      areaId: null,
      category: '',
      framework: '',
      database: '',
      customerId: null,
      repositoryUrl: '',
    });
    await comp.submit();
    expect(apiMock.create).toHaveBeenCalledWith('ws1', expect.objectContaining({ name: 'My Project', key: 'MYPROJ' }));
  });

  it('rejects repositoryUrl values without a protocol', () => {
    const comp = fixture.componentInstance;
    comp.form.controls.repositoryUrl.setValue('github.com/empresa/proj');
    expect(comp.form.controls.repositoryUrl.invalid).toBe(true);
  });

  it('accepts https + git repositoryUrl values', () => {
    const comp = fixture.componentInstance;
    comp.form.controls.repositoryUrl.setValue('https://github.com/empresa/proj');
    expect(comp.form.controls.repositoryUrl.valid).toBe(true);
    comp.form.controls.repositoryUrl.setValue('git@github.com:empresa/proj.git');
    expect(comp.form.controls.repositoryUrl.valid).toBe(true);
  });
});
