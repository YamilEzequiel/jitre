import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SkeletonComponent } from './skeleton.component';

describe('SkeletonComponent', () => {
  let fixture: ComponentFixture<SkeletonComponent>;

  function create(inputs: Partial<{ variant: string; width: string; height: string; rounded: boolean }> = {}) {
    fixture = TestBed.createComponent(SkeletonComponent);
    const comp = fixture.componentInstance;
    if (inputs.variant !== undefined) fixture.componentRef.setInput('variant', inputs.variant);
    if (inputs.width !== undefined) fixture.componentRef.setInput('width', inputs.width);
    if (inputs.height !== undefined) fixture.componentRef.setInput('height', inputs.height);
    if (inputs.rounded !== undefined) fixture.componentRef.setInput('rounded', inputs.rounded);
    fixture.detectChanges();
    return { comp, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('renders with default text variant', () => {
    const { el } = create();
    expect(el.querySelector('[data-testid="skeleton"]')).toBeTruthy();
  });

  it('text variant has animate-pulse class', () => {
    const { el } = create({ variant: 'text' });
    const el2 = el.querySelector('[data-testid="skeleton"]') as HTMLElement;
    expect(el2.className).toContain('animate-pulse');
  });

  it('circle variant renders rounded-full', () => {
    const { el } = create({ variant: 'circle' });
    const el2 = el.querySelector('[data-testid="skeleton"]') as HTMLElement;
    expect(el2.className).toContain('rounded-full');
  });

  it('card variant renders rounded-lg', () => {
    const { el } = create({ variant: 'card' });
    const el2 = el.querySelector('[data-testid="skeleton"]') as HTMLElement;
    expect(el2.className).toContain('rounded-lg');
  });

  it('rect variant renders without extra rounding', () => {
    const { el } = create({ variant: 'rect' });
    const el2 = el.querySelector('[data-testid="skeleton"]') as HTMLElement;
    expect(el2.className).not.toContain('rounded-full');
  });

  it('applies custom width and height via style', () => {
    const { el } = create({ width: '200px', height: '40px' });
    const el2 = el.querySelector('[data-testid="skeleton"]') as HTMLElement;
    expect(el2.style.width).toBe('200px');
    expect(el2.style.height).toBe('40px');
  });
});
