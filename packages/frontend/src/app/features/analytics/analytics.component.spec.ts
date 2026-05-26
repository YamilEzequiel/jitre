import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { AnalyticsComponent } from './analytics.component';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { AuthService } from '../../core/auth/auth.service';
import { signal } from '@angular/core';

describe('AnalyticsComponent', () => {
  let fixture: ComponentFixture<AnalyticsComponent>;
  let analyticsMock: {
    getVelocity: ReturnType<typeof vi.fn>;
    getThroughput: ReturnType<typeof vi.fn>;
    getWorkload: ReturnType<typeof vi.fn>;
    getAiUsage: ReturnType<typeof vi.fn>;
    lastNDays: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    analyticsMock = {
      getVelocity: vi.fn().mockResolvedValue([{ period: '2026-04-01', value: 2 }]),
      getThroughput: vi.fn().mockResolvedValue([{ period: '2026-04-01', value: 3 }]),
      getWorkload: vi.fn().mockResolvedValue([{ key: '__unassigned__', count: 4 }]),
      getAiUsage: vi.fn().mockResolvedValue([{ period: '2026-04-01', requests: 10, costUsd: '1.25', totalTokens: 1000 }]),
      lastNDays: vi.fn().mockReturnValue({ from: '2026-04-01T00:00:00Z', to: '2026-05-01T00:00:00Z' }),
    };

    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: AuthService, useValue: { currentUser: signal({ role: 'admin' }).asReadonly() } },
      ],
    });

    fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads analytics on init and maps backend DTOs', async () => {
    await fixture.componentInstance.loadPromise;
    expect(analyticsMock.getVelocity).toHaveBeenCalled();
    expect(analyticsMock.getThroughput).toHaveBeenCalled();
    expect(analyticsMock.getWorkload).toHaveBeenCalledWith('assignee');
    expect(fixture.componentInstance.velocityData()).toEqual([{ date: '2026-04-01', value: 2 }]);
    expect(fixture.componentInstance.workloadData()).toEqual([{ label: 'Sin asignar', count: 4 }]);
  });

  it('dateRange defaults to last 30 days', () => {
    expect(fixture.componentInstance.rangeDays()).toBe(30);
  });

  it('isAdmin computed from auth', () => {
    expect(fixture.componentInstance.isAdmin()).toBe(true);
  });
});
