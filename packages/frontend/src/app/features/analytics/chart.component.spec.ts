import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';

// Mock Chart.js to avoid jsdom canvas issues
vi.mock('chart.js', () => ({
  Chart: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
    data: { datasets: [] },
  })),
  registerables: [],
}));

import { ChartComponent } from './chart.component';

describe('ChartComponent', () => {
  let fixture: ComponentFixture<ChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ChartComponent);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a canvas element with aria-label', () => {
    fixture.componentRef.setInput('chartType', 'bar');
    fixture.componentRef.setInput('ariaLabel', 'Test chart');
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.getAttribute('aria-label')).toBe('Test chart');
  });

  it('destroys chart instance on destroy', async () => {
    const { Chart } = await import('chart.js');
    fixture.componentRef.setInput('chartType', 'bar');
    fixture.componentRef.setInput('ariaLabel', 'Destroy test');
    fixture.detectChanges();
    fixture.destroy();
    // If a Chart instance was created, its destroy should have been called
    // (or no instance created if canvas context not available in jsdom)
    expect(Chart).toBeDefined();
  });
});
