import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSettingsPanelComponent } from './ai-settings-panel.component';
import { AuthService } from '../../../core/auth/auth.service';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { ToastService } from '../../../core/toast/toast.service';

describe('AiSettingsPanelComponent', () => {
  let fixture: ComponentFixture<AiSettingsPanelComponent>;
  let httpMock: HttpTestingController;
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AiSettingsPanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            currentWorkspace: signal({ id: 'ws-1', name: 'Workspace', slug: 'workspace', role: 'owner' }).asReadonly(),
          },
        },
        {
          provide: AnalyticsService,
          useValue: {
            lastNDays: () => ({ from: 'from', to: 'to' }),
            getAiUsage: vi.fn().mockResolvedValue([
              { costUsd: '0.125000' },
              { costUsd: '0.375000' },
            ]),
          },
        },
        { provide: ToastService, useValue: toast },
      ],
    });

    fixture = TestBed.createComponent(AiSettingsPanelComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  async function loadSettings(): Promise<void> {
    const request = httpMock.expectOne(
      req =>
        req.url === '/api/v1/settings/ai' &&
        req.params.get('workspaceId') === 'ws-1',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      'ai.provider': 'OPENAI',
      'ai.daily_budget_usd': 9,
      'ai.enabled': true,
    });
    await fixture.whenStable();
  }

  it('keeps the only implemented provider selectable while loading stored settings', async () => {
    await loadSettings();

    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      provider: 'GEMINI',
      dailyBudget: 9,
      enabled: true,
    });
    expect(fixture.componentInstance.spentUsd()).toBe('0.50');
  });

  it('persists AI settings using the backend key/value contract', async () => {
    await loadSettings();

    fixture.componentInstance.form.patchValue({ dailyBudget: 12, enabled: false });
    const saving = fixture.componentInstance.save();
    const requests = httpMock.match('/api/v1/settings/ai');

    expect(requests.map(req => req.request.body)).toEqual([
      { workspaceId: 'ws-1', key: 'ai.provider', value: 'GEMINI' },
      { workspaceId: 'ws-1', key: 'ai.daily_budget_usd', value: 12 },
      { workspaceId: 'ws-1', key: 'ai.enabled', value: false },
    ]);
    requests.forEach(request => request.flush(null));
    await saving;

    expect(toast.success).toHaveBeenCalledWith('AI settings saved');
  });
});
