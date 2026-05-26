import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationSettingsPanelComponent } from './notification-settings-panel.component';
import { ToastService } from '../../../core/toast/toast.service';

describe('NotificationSettingsPanelComponent', () => {
  let fixture: ComponentFixture<NotificationSettingsPanelComponent>;
  let httpMock: HttpTestingController;
  const toast = { error: vi.fn() };
  const preferences = {
    in_app: true,
    email: true,
    batching_window_minutes: 0,
    task_assigned: true,
    task_due_soon: false,
    task_completed: true,
    task_status_changed: true,
    project_member_added: true,
    ai_quota_warning: false,
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [NotificationSettingsPanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
      ],
    });

    fixture = TestBed.createComponent(NotificationSettingsPanelComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/v1/settings/me').flush({ notifications: preferences });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('loads real supported notification settings', () => {
    expect(fixture.componentInstance.prefs()?.task_due_soon).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Task due soon');
    expect(fixture.nativeElement.textContent).not.toContain('Mentioned in comment');
  });

  it('persists the exact notification key exposed by the backend', () => {
    fixture.componentInstance.toggle('task_due_soon');

    const request = httpMock.expectOne('/api/v1/settings/me');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      key: 'notification.task_due_soon',
      value: true,
    });
    request.flush(null);
  });
});
