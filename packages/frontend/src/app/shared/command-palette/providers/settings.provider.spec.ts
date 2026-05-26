import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsProvider } from './settings.provider';

describe('SettingsProvider', () => {
  let provider: SettingsProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SettingsProvider] });
    provider = TestBed.inject(SettingsProvider);
  });

  it('surfaces top-level settings tabs', async () => {
    const results = await provider.search('');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.type === 'settings')).toBe(true);
  });

  it('filters settings by query', async () => {
    const results = await provider.search('ai');
    expect(results.some(r => r.label.toLowerCase().includes('ai'))).toBe(true);
  });
});
