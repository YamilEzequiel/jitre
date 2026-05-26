import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandPaletteService } from './command-palette.service';
import type { CommandProvider } from './command-palette.service';
import type { CommandResult } from './recent-items.helper';

function makeResult(id: string, label: string): CommandResult {
  return { id, label, type: 'navigation', action: vi.fn() };
}

describe('CommandPaletteService', () => {
  let service: CommandPaletteService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CommandPaletteService] });
    service = TestBed.inject(CommandPaletteService);
    service.recents.clear();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('isOpen() starts false', () => {
    expect(service.isOpen()).toBe(false);
  });

  it('open() sets isOpen to true', () => {
    service.open();
    expect(service.isOpen()).toBe(true);
  });

  it('close() sets isOpen to false', () => {
    service.open();
    service.close();
    expect(service.isOpen()).toBe(false);
  });

  it('search() with empty query returns recent items', async () => {
    service.recents.add(makeResult('r1', 'Recent One'));
    const results = await service.search('');
    expect(results.some(r => r.id === 'r1')).toBe(true);
  });

  it('one failing provider does not prevent others from returning results', async () => {
    const failProvider: CommandProvider = {
      search: vi.fn().mockRejectedValue(new Error('provider fail')),
    };
    const goodProvider: CommandProvider = {
      search: vi.fn().mockResolvedValue([makeResult('good1', 'Good Result')]),
    };
    service.registerProvider(failProvider);
    service.registerProvider(goodProvider);
    const results = await service.search('query');
    expect(results.some(r => r.id === 'good1')).toBe(true);
  });

  it('caps results at 50', async () => {
    const bigProvider: CommandProvider = {
      search: vi.fn().mockResolvedValue(
        Array.from({ length: 60 }, (_, i) => makeResult(`id_${i}`, `Result ${i}`)),
      ),
    };
    service.registerProvider(bigProvider);
    const results = await service.search('x');
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it('new search aborts in-flight previous search via AbortController', async () => {
    let aborted = false;
    const slowProvider: CommandProvider = {
      search: vi.fn().mockImplementation(
        (_q, signal) =>
          new Promise((resolve) => {
            if (signal) {
              signal.addEventListener('abort', () => {
                aborted = true;
                resolve([]); // resolve immediately on abort so Promise.allSettled completes
              });
            }
            // Resolve after a tick so we can interleave
            setTimeout(() => resolve([]), 100);
          }),
      ),
    };
    service.registerProvider(slowProvider);
    // Start first search — don't await
    service.search('first');
    // Immediately start second search — should abort the first
    await service.search('second');
    expect(aborted).toBe(true);
  });
});
