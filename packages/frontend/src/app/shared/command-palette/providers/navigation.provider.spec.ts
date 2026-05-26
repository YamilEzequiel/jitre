import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NavigationProvider } from './navigation.provider';

describe('NavigationProvider', () => {
  let provider: NavigationProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NavigationProvider] });
    provider = TestBed.inject(NavigationProvider);
  });

  it('returns navigation results matching query (case-insensitive)', async () => {
    const results = await provider.search('dash');
    expect(results.some(r => r.label.toLowerCase().includes('dash'))).toBe(true);
  });

  it('returns empty results for unmatched query', async () => {
    const results = await provider.search('xyznonexistent');
    expect(results).toEqual([]);
  });

  it('returns all results for empty query', async () => {
    const results = await provider.search('');
    expect(results.length).toBeGreaterThan(0);
  });
});
