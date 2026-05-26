import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskFilterBarComponent } from './task-filter-bar.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('TaskFilterBarComponent', () => {
  let fixture: ComponentFixture<TaskFilterBarComponent>;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fixture = TestBed.createComponent(TaskFilterBarComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('emits filterChange when status changes', () => {
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.componentInstance.statusControl.setValue('status-uuid-1');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ statusId: 'status-uuid-1' }));
  });

  it('emits filterChange when search query changes after debounce', () => {
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.componentInstance.searchControl.setValue('fix bug');
    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ q: 'fix bug' }));
  });

  it('emits filterChange when priority changes', () => {
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.componentInstance.priorityControl.setValue('high');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ priority: 'high' }));
  });

  it('emits filterChange when assignee changes', () => {
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.componentInstance.assigneeControl.setValue('user-alpha');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ assigneeUserId: 'user-alpha' }));
  });

  it('emits filterChange when label changes', () => {
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.componentInstance.labelControl.setValue('label-1');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ labelId: 'label-1' }));
  });

  it('reset clears all controls', () => {
    const comp = fixture.componentInstance;
    comp.statusControl.setValue('status-uuid-1');
    comp.priorityControl.setValue('high');
    comp.typeControl.setValue('bug');
    comp.assigneeControl.setValue('u1');
    comp.labelControl.setValue('l1');
    comp.searchControl.setValue('bug');
    comp.reset();
    expect(comp.statusControl.value).toBeNull();
    expect(comp.priorityControl.value).toBeNull();
    expect(comp.typeControl.value).toBeNull();
    expect(comp.assigneeControl.value).toBeNull();
    expect(comp.labelControl.value).toBeNull();
    expect(comp.searchControl.value).toBe('');
  });

  it('emits filterChange when type changes', () => {
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.componentInstance.typeControl.setValue('bug');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'bug' }));
  });

  it('emits null type when reset', () => {
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.componentInstance.typeControl.setValue('incident');
    spy.mockClear();
    fixture.componentInstance.reset();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: null }));
  });
});
