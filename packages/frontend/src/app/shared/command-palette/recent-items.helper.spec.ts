import { describe, it, expect, beforeEach } from 'vitest';
import { RecentItemsHelper } from './recent-items.helper';

describe('RecentItemsHelper', () => {
  let helper: RecentItemsHelper;

  beforeEach(() => {
    // Use a unique key to avoid localStorage cross-test pollution
    helper = new RecentItemsHelper('test_recent_items_spec');
    helper.clear();
  });

  it('starts empty', () => {
    expect(helper.get()).toEqual([]);
  });

  it('add() inserts item at front', () => {
    helper.add({ id: '1', label: 'Alpha', type: 'task', action: () => {} });
    helper.add({ id: '2', label: 'Beta', type: 'task', action: () => {} });
    const items = helper.get();
    expect(items[0].id).toBe('2');
    expect(items[1].id).toBe('1');
  });

  it('add() deduplicates by id (moves to front)', () => {
    helper.add({ id: '1', label: 'Alpha', type: 'task', action: () => {} });
    helper.add({ id: '2', label: 'Beta', type: 'task', action: () => {} });
    helper.add({ id: '1', label: 'Alpha', type: 'task', action: () => {} });
    const items = helper.get();
    expect(items.length).toBe(2);
    expect(items[0].id).toBe('1');
  });

  it('caps at max 10 items', () => {
    for (let i = 0; i < 15; i++) {
      helper.add({ id: `${i}`, label: `Item ${i}`, type: 'task', action: () => {} });
    }
    expect(helper.get().length).toBe(10);
  });

  it('serializes and deserializes from localStorage', () => {
    helper.add({ id: '42', label: 'Persist me', type: 'project', action: () => {} });
    const helper2 = new RecentItemsHelper('test_recent_items_spec');
    const items = helper2.get();
    expect(items[0].id).toBe('42');
    expect(items[0].label).toBe('Persist me');
  });

  it('clear() empties the list', () => {
    helper.add({ id: '1', label: 'Alpha', type: 'task', action: () => {} });
    helper.clear();
    expect(helper.get()).toEqual([]);
  });
});
