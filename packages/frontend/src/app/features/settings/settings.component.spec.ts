import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { SettingsComponent } from './settings.component';
import { AuthService } from '../../core/auth/auth.service';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ToastService } from '../../core/toast/toast.service';

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;

  function makeAuth(role: string) {
    return {
      currentWorkspace: signal({ role, id: 'ws1', name: 'Workspace', slug: 'workspace' }).asReadonly(),
      currentUser: signal({
        id: 'u1',
        email: 'x@test.com',
        displayName: 'X',
        role: role === 'member' ? 'member' : 'admin',
      }).asReadonly(),
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('as admin', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        schemas: [NO_ERRORS_SCHEMA],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
          { provide: AuthService, useValue: makeAuth('admin') },
        ],
      });
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    it('creates component', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('exposes workspace tab for admin', () => {
      const tabs = fixture.componentInstance.visibleTabs();
      expect(tabs.map(t => t.value)).toContain('workspace');
    });

    it('exposes ai tab for admin', () => {
      const tabs = fixture.componentInstance.visibleTabs();
      expect(tabs.map(t => t.value)).toContain('ai');
    });
  });

  describe('as owner', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        schemas: [NO_ERRORS_SCHEMA],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
          { provide: AuthService, useValue: makeAuth('owner') },
        ],
      });
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    it('exposes admin tabs for the workspace owner', () => {
      const tabs = fixture.componentInstance.visibleTabs();
      expect(tabs.map(t => t.value)).toContain('ai');
      expect(tabs.map(t => t.value)).toContain('workspace');
    });
  });

  describe('as member', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        schemas: [NO_ERRORS_SCHEMA],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
          { provide: AuthService, useValue: makeAuth('member') },
        ],
      });
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    it('hides workspace tab for non-admin', () => {
      const tabs = fixture.componentInstance.visibleTabs();
      expect(tabs.map(t => t.value)).not.toContain('workspace');
    });
  });
});
