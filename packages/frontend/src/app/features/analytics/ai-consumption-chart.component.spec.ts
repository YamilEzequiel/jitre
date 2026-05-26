import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NO_ERRORS_SCHEMA, signal, computed } from '@angular/core';

vi.mock('chart.js', () => ({
  Chart: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
    data: { datasets: [] },
  })),
  registerables: [],
}));

import { AiConsumptionChartComponent } from './ai-consumption-chart.component';
import { AuthService } from '../../core/auth/auth.service';

describe('AiConsumptionChartComponent', () => {
  let fixture: ComponentFixture<AiConsumptionChartComponent>;

  describe('when admin', () => {
    beforeEach(() => {
      const userSignal = signal({ id: 'u1', email: 'a@b.com', role: 'admin', name: 'Admin' });
      TestBed.configureTestingModule({
        schemas: [NO_ERRORS_SCHEMA],
        providers: [
          {
            provide: AuthService,
            useValue: {
              currentUser: userSignal,
              isAuthenticated: computed(() => true),
            },
          },
        ],
      });
      fixture = TestBed.createComponent(AiConsumptionChartComponent);
    });

    afterEach(() => TestBed.resetTestingModule());

    it('creates component', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('isAdmin computed returns true for admin role', () => {
      expect(fixture.componentInstance.isAdmin()).toBe(true);
    });
  });

  describe('when non-admin', () => {
    beforeEach(() => {
      const userSignal = signal({ id: 'u2', email: 'b@b.com', role: 'member', name: 'Member' });
      TestBed.configureTestingModule({
        schemas: [NO_ERRORS_SCHEMA],
        providers: [
          {
            provide: AuthService,
            useValue: {
              currentUser: userSignal,
              isAuthenticated: computed(() => true),
            },
          },
        ],
      });
      fixture = TestBed.createComponent(AiConsumptionChartComponent);
    });

    afterEach(() => TestBed.resetTestingModule());

    it('isAdmin computed returns false for member role', () => {
      expect(fixture.componentInstance.isAdmin()).toBe(false);
    });
  });
});
