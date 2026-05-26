import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthLayoutComponent } from './auth-layout.component';
import { provideRouter } from '@angular/router';

describe('AuthLayoutComponent', () => {
  let fixture: ComponentFixture<AuthLayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(AuthLayoutComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders centered card wrapper', () => {
    const el = fixture.nativeElement as HTMLElement;
    const card = el.querySelector('[data-testid="auth-card"]');
    expect(card).toBeTruthy();
  });

  it('stretches the brand panel through the full auth canvas', () => {
    const brandPanel = (fixture.nativeElement as HTMLElement).querySelector('jt-brand-panel');
    const panelSurface = brandPanel?.querySelector('aside');
    expect(brandPanel?.classList.contains('h-full')).toBe(true);
    expect(panelSurface?.classList.contains('h-full')).toBe(true);
  });

  it('renders the polished login brand copy without broken characters', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Jira + Trello + Tempo · one flow');
    expect(text).toContain('“Finally, one place for roadmap, execution and time visibility.”');
    expect(text).toContain('© 2026 Jitre');
    expect(text).not.toContain('�');
  });
});
