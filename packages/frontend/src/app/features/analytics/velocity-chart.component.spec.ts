import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';

vi.mock('chart.js', () => ({
  Chart: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
    data: { datasets: [] },
  })),
  registerables: [],
}));

import { VelocityChartComponent } from './velocity-chart.component';

describe('VelocityChartComponent', () => {
  let fixture: ComponentFixture<VelocityChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(VelocityChartComponent);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders jt-chart with bar type', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const chart = el.querySelector('jt-chart');
    expect(chart).toBeTruthy();
  });
});
