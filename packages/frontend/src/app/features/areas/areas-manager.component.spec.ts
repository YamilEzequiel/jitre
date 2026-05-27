import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { AreasManagerComponent } from './areas-manager.component';
import { AreaApiService, Area } from '../../stores/area-api.service';
import { AreaStore } from '../../stores/area.store';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

const fakeArea = (id: string, name = `Area ${id}`): Area => ({
  id,
  workspaceId: 'ws-1',
  name,
  color: '#7c3aed',
  icon: null,
  description: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
});

describe('AreasManagerComponent', () => {
  let fixture: ComponentFixture<AreasManagerComponent>;
  const areasSignal = signal<Area[]>([]);
  const loadingSignal = signal(false);
  const upsert = vi.fn((area: Area) =>
    areasSignal.update((list) => {
      const idx = list.findIndex((a) => a.id === area.id);
      if (idx === -1) return [...list, area];
      const next = list.slice();
      next[idx] = area;
      return next;
    }),
  );
  const remove = vi.fn((id: string) =>
    areasSignal.update((list) => list.filter((a) => a.id !== id)),
  );
  const load = vi.fn().mockResolvedValue(undefined);
  const apiMock = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(fakeArea('a1', 'New')),
    update: vi.fn().mockResolvedValue(fakeArea('a1', 'Updated')),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    areasSignal.set([]);
    loadingSignal.set(false);
    upsert.mockClear();
    remove.mockClear();
    load.mockClear();
    apiMock.create.mockClear();
    apiMock.update.mockClear();
    apiMock.delete.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AreaStore,
          useValue: {
            areas: areasSignal.asReadonly(),
            loading: loadingSignal.asReadonly(),
            load,
            upsert,
            remove,
          },
        },
        { provide: AreaApiService, useValue: apiMock },
        {
          provide: AuthService,
          useValue: {
            currentWorkspace: signal({
              id: 'ws-1',
              name: 'WS',
              slug: 'ws',
              role: 'admin',
            }).asReadonly(),
            currentUser: signal({ id: 'u1', role: 'admin' }).asReadonly(),
          },
        },
        { provide: ToastService, useValue: toast },
      ],
    });

    fixture = TestBed.createComponent(AreasManagerComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders empty state when no areas', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sin áreas todavía');
  });

  it('opens create dialog with default color', () => {
    const comp = fixture.componentInstance;
    comp.openCreate();
    expect(comp.showDialog()).toBe(true);
    expect(comp.form.controls.color.value).toBe('#7c3aed');
  });

  it('save() calls api.create when not editing', async () => {
    const comp = fixture.componentInstance;
    comp.openCreate();
    comp.form.controls.name.setValue('Tech');
    await comp.save();
    expect(apiMock.create).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ name: 'Tech', color: '#7c3aed' }),
    );
    expect(upsert).toHaveBeenCalled();
  });

  it('save() calls api.update when editing', async () => {
    const comp = fixture.componentInstance;
    comp.openEdit(fakeArea('a1', 'Old'));
    comp.form.controls.name.setValue('Renamed');
    await comp.save();
    expect(apiMock.update).toHaveBeenCalledWith(
      'ws-1',
      'a1',
      expect.objectContaining({ name: 'Renamed' }),
    );
  });

  it('performDelete() calls api.delete and removes from store', async () => {
    const comp = fixture.componentInstance;
    areasSignal.set([fakeArea('a1')]);
    await comp.performDelete(fakeArea('a1'));
    expect(apiMock.delete).toHaveBeenCalledWith('ws-1', 'a1');
    expect(remove).toHaveBeenCalledWith('a1');
  });
});
