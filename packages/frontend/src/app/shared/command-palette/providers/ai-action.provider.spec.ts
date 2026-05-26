import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiActionProvider } from './ai-action.provider';
import { Router, ActivatedRoute } from '@angular/router';

describe('AiActionProvider', () => {
  let provider: AiActionProvider;
  let urlMock: ReturnType<typeof vi.fn>;

  describe('when on a task route', () => {
    beforeEach(() => {
      urlMock = vi.fn().mockReturnValue('/tasks/abc123');
      TestBed.configureTestingModule({
        providers: [
          AiActionProvider,
          { provide: Router, useValue: { url: '/tasks/abc123', navigate: vi.fn() } },
          { provide: ActivatedRoute, useValue: {} },
        ],
      });
      provider = TestBed.inject(AiActionProvider);
    });

    it('shows "Describe current task" action', async () => {
      const results = await provider.search('');
      expect(results.some(r => r.label.toLowerCase().includes('describe'))).toBe(true);
    });
  });

  describe('when NOT on a task route', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          AiActionProvider,
          { provide: Router, useValue: { url: '/projects', navigate: vi.fn() } },
          { provide: ActivatedRoute, useValue: {} },
        ],
      });
      provider = TestBed.inject(AiActionProvider);
    });

    it('hides task-specific actions', async () => {
      const results = await provider.search('');
      expect(results.some(r => r.label.toLowerCase().includes('describe'))).toBe(false);
    });
  });
});
