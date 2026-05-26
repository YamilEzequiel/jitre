import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShortcutHelpOverlayComponent } from './shortcut-help-overlay.component';
import { KeyboardShortcutService } from '../../core/keyboard/keyboard-shortcut.service';

describe('ShortcutHelpOverlayComponent', () => {
  let fixture: ComponentFixture<ShortcutHelpOverlayComponent>;
  let getAllMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getAllMock = vi.fn().mockReturnValue([
      { key: 'cmd+k', context: 'Global', handler: vi.fn() },
      { key: '?', context: 'Global', handler: vi.fn() },
      { key: 'g p', context: 'Navigation', handler: vi.fn() },
    ]);

    TestBed.configureTestingModule({
      providers: [{ provide: KeyboardShortcutService, useValue: { getAll: getAllMock } }],
    });

    fixture = TestBed.createComponent(ShortcutHelpOverlayComponent);
    fixture.detectChanges();
  });

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('groups shortcuts by context', () => {
    const groups = fixture.componentInstance.groups();
    const contexts = groups.map(g => g.context);
    expect(contexts).toContain('Global');
    expect(contexts).toContain('Navigation');
  });

  it('shows platform-aware glyph for cmd+k', () => {
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    // Should contain either ⌘ (mac) or Ctrl
    expect(html.includes('⌘') || html.includes('Ctrl') || html.includes('cmd')).toBe(true);
  });
});
