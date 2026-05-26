import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationBellComponent } from './notification-bell.component';
import { NotificationStore } from '../../stores/notification.store';
import { Router } from '@angular/router';
import { signal, computed } from '@angular/core';

describe('NotificationBellComponent', () => {
  let fixture: ComponentFixture<NotificationBellComponent>;
  const unreadCount = computed(() => 3);
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    routerMock = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: NotificationStore,
          useValue: { unreadCount },
        },
        { provide: Router, useValue: routerMock },
      ],
    });

    fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows unread badge count', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('3');
  });
});
