import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateProjectComponent } from './create-project.component';
import { ProjectApiService } from '../../../stores/project-api.service';
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
    comp.form.setValue({ name: 'My Project', key: 'MYPROJ', description: '', color: '#4f46e5', icon: '', startDate: '', targetDate: '' });
    await comp.submit();
    expect(apiMock.create).toHaveBeenCalledWith('ws1', expect.objectContaining({ name: 'My Project', key: 'MYPROJ' }));
  });
});
