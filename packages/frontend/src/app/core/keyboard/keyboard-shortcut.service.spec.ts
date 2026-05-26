import { TestBed } from '@angular/core/testing';
import { KeyboardShortcutService } from './keyboard-shortcut.service';

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
  document.dispatchEvent(event);
  return event;
}

describe('KeyboardShortcutService', () => {
  let service: KeyboardShortcutService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [KeyboardShortcutService] });
    service = TestBed.inject(KeyboardShortcutService);
  });

  it('register + unregister: handler called after register, not called after unregister', () => {
    const handler = vi.fn();
    const unregister = service.register({ key: 'x', handler });
    fireKey('x');
    expect(handler).toHaveBeenCalledTimes(1);
    unregister();
    fireKey('x');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('cmd+k dispatches handler (metaKey or ctrlKey)', () => {
    const handler = vi.fn();
    service.register({ key: 'cmd+k', handler });
    // macOS
    fireKey('k', { metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    // Windows/Linux
    fireKey('k', { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('? key dispatches handler', () => {
    const handler = vi.fn();
    service.register({ key: '?', handler });
    fireKey('?');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('sequence g→p dispatches handler on second key within timeout', async () => {
    const handler = vi.fn();
    service.register({ key: 'g p', handler });
    fireKey('g');
    fireKey('p');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('sequence timeout drains buffer so incomplete sequence does not fire', async () => {
    const handler = vi.fn();
    service.register({ key: 'g p', handler });
    fireKey('g');
    await new Promise(r => setTimeout(r, 1600));
    fireKey('p');
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips handler when typing in input field (except Escape)', () => {
    const handler = vi.fn();
    const escHandler = vi.fn();
    service.register({ key: 'x', handler });
    service.register({ key: 'Escape', handler: escHandler });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const eventX = new KeyboardEvent('keydown', { key: 'x', bubbles: true });
    input.dispatchEvent(eventX);
    expect(handler).not.toHaveBeenCalled();

    const eventEsc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    input.dispatchEvent(eventEsc);
    expect(escHandler).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
  });
});
