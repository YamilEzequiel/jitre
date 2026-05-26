import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { CommandPaletteComponent } from './command-palette.component';
import { CommandPaletteService } from './command-palette.service';
import type { CommandResult } from './recent-items.helper';

function makeResult(id: string, label: string): CommandResult {
  return { id, label, type: 'navigation', action: vi.fn() };
}

describe('CommandPaletteComponent', () => {
  const isOpenSignal = signal(false);
  let closeMock: ReturnType<typeof vi.fn>;
  let searchMock: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<CommandPaletteComponent>;

  beforeEach(() => {
    closeMock = vi.fn();
    searchMock = vi.fn().mockResolvedValue([]);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: CommandPaletteService,
          useValue: {
            isOpen: isOpenSignal.asReadonly(),
            open: vi.fn(),
            close: closeMock,
            search: searchMock,
            recents: { get: () => [], add: vi.fn(), clear: vi.fn() },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(CommandPaletteComponent);
    isOpenSignal.set(false);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not render dialog when closed', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="command-palette-dialog"]')).toBeNull();
  });

  it('renders dialog when open', async () => {
    isOpenSignal.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="command-palette-dialog"]')).toBeTruthy();
  });

  it('Escape key calls close()', async () => {
    isOpenSignal.set(true);
    fixture.detectChanges();
    // Dispatch on the inner dialog div where (keydown) is bound
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="command-palette-dialog"]') as HTMLElement;
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    dialog.dispatchEvent(event);
    fixture.detectChanges();
    expect(closeMock).toHaveBeenCalled();
  });

  it('Enter executes active result action', async () => {
    const actionMock = vi.fn();
    const results = [makeResult('r1', 'Alpha')];
    results[0].action = actionMock;
    searchMock.mockResolvedValue(results);

    isOpenSignal.set(true);
    fixture.detectChanges();

    // Trigger a query
    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = 'al';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    // Press Enter
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(enterEvent);
    expect(actionMock).toHaveBeenCalled();
  });

  it('ArrowDown moves activeIndex forward', async () => {
    const results = [makeResult('r1', 'Alpha'), makeResult('r2', 'Beta')];
    searchMock.mockResolvedValue(results);

    isOpenSignal.set(true);
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = 'a';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    fixture.detectChanges();

    const before = fixture.componentInstance.activeIndex();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(fixture.componentInstance.activeIndex()).toBe(before + 1);
  });
});
