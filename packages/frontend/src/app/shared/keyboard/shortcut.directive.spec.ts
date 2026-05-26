import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, EventEmitter, Output } from '@angular/core';
import { ShortcutDirective } from './shortcut.directive';
import { KeyboardShortcutService } from '../../core/keyboard/keyboard-shortcut.service';

@Component({
  template: `<button [jtShortcut]="'ctrl+s'" (jtShortcutTriggered)="triggered.emit($event)">Save</button>`,
  imports: [ShortcutDirective],
})
class TestHostComponent {
  @Output() triggered = new EventEmitter<KeyboardEvent>();
}

describe('ShortcutDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let registerMock: ReturnType<typeof vi.fn>;
  let unregisterMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unregisterMock = vi.fn();
    registerMock = vi.fn().mockReturnValue(unregisterMock);

    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: KeyboardShortcutService, useValue: { register: registerMock } }],
    });
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('registers shortcut on init', () => {
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'ctrl+s' }),
    );
  });

  it('unregisters shortcut on destroy', () => {
    fixture.destroy();
    expect(unregisterMock).toHaveBeenCalled();
  });

  it('emits jtShortcutTriggered when shortcut fires', () => {
    const triggered = vi.fn();
    fixture.componentInstance.triggered.subscribe(triggered);
    // Simulate the registered handler being called
    const call = registerMock.mock.calls[0][0];
    const fakeEvent = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    call.handler(fakeEvent);
    expect(triggered).toHaveBeenCalledWith(fakeEvent);
  });
});
