import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiQuotaIndicatorComponent } from './ai-quota-indicator.component';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { AuthService } from '../../../core/auth/auth.service';
import { signal, computed } from '@angular/core';

describe('AiQuotaIndicatorComponent', () => {
  let fixture: ComponentFixture<AiQuotaIndicatorComponent>;
  let analyticsMock: { getAiUsage: ReturnType<typeof vi.fn>; lastNDays: ReturnType<typeof vi.fn> };
  const isAdminSignal = computed(() => true);
  const isNotAdminSignal = computed(() => false);

  beforeEach(() => {
    analyticsMock = {
      getAiUsage: vi.fn().mockResolvedValue([{ costUsd: '0.25' }, { costUsd: '0.50' }]),
      lastNDays: vi.fn().mockReturnValue({ from: '2026-04-01T00:00:00Z', to: '2026-05-01T00:00:00Z' }),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AnalyticsService, useValue: analyticsMock },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ role: 'admin' }).asReadonly() },
        },
      ],
    });

    fixture = TestBed.createComponent(AiQuotaIndicatorComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('isAdmin computed true when user role is admin', () => {
    expect(fixture.componentInstance.isAdmin()).toBe(true);
  });

  it('totals the analytics series returned by the API', async () => {
    await fixture.whenStable();
    expect(fixture.componentInstance.spentUsd()).toBe('0.75');
  });
});
