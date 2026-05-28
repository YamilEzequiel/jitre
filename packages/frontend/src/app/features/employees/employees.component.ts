import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { MultiSelectModule } from 'primeng/multiselect';
import { TabsModule } from 'primeng/tabs';
import { Employee, EmployeeApiService, UpdateEmployeeBody } from '../../stores/employee-api.service';
import { OrgGraphApiService } from '../../stores/org-graph-api.service';
import { Area } from '../../stores/area-api.service';
import { AreaStore } from '../../stores/area.store';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { OrgChartComponent } from './org-chart/org-chart.component';
import { AreasManagerComponent } from '../areas/areas-manager.component';
import { VirtualListComponent } from '../../shared/virtual-list/virtual-list.component';

function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

@Component({
  selector: 'jt-employees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, TableModule, MultiSelectModule, TabsModule, DatePipe, OrgChartComponent, AreasManagerComponent, VirtualListComponent],
  template: `
    <div class="flex flex-col gap-6 max-w-7xl" [class.min-h-screen]="activeTab() === 'org'">
      <!-- Header -->
      <header
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 flex flex-wrap items-end justify-between gap-4"
      >
        <div class="space-y-3">
          <div class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1">
            <span class="pi pi-users text-violet-600" aria-hidden="true"></span>
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Empleados</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-black tracking-tight leading-[1.05]">
            <span class="block bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
              Directorio
            </span>
          </h1>
          <p class="text-xs text-slate-500">
            {{ filtered().length }} de {{ employees().length }} empleados
            @if (canManage()) {
              · <span class="text-violet-700 font-semibold">Modo admin</span>
            }
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
            <input
              type="search"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="Buscar por nombre, email, puesto…"
              class="w-72 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div class="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button type="button" (click)="viewMode.set('list')"
                    [class]="'px-3 py-2 text-xs font-bold transition ' + (viewMode() === 'list' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')"
                    aria-label="Vista lista">
              <i class="pi pi-list text-xs" aria-hidden="true"></i>
            </button>
            <button type="button" (click)="viewMode.set('grid')"
                    [class]="'px-3 py-2 text-xs font-bold transition ' + (viewMode() === 'grid' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')"
                    aria-label="Vista cuadrícula">
              <i class="pi pi-th-large text-xs" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- Top-level tabs: directory vs org chart -->
      <nav class="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm shadow-slate-200/70 w-fit" role="tablist" aria-label="Vista de empleados">
        <button type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === 'directory'"
                (click)="activeTab.set('directory')"
                [class]="'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ' + (activeTab() === 'directory' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50')">
          <i class="pi pi-list text-[11px]" aria-hidden="true"></i>
          Directorio
        </button>
        <button type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === 'org'"
                (click)="activeTab.set('org')"
                [class]="'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ' + (activeTab() === 'org' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50')">
          <i class="pi pi-sitemap text-[11px]" aria-hidden="true"></i>
          Organigrama
        </button>
        @if (canManage()) {
          <button type="button"
                  role="tab"
                  [attr.aria-selected]="activeTab() === 'areas'"
                  (click)="activeTab.set('areas')"
                  [class]="'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ' + (activeTab() === 'areas' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50')">
            <i class="pi pi-th-large text-[11px]" aria-hidden="true"></i>
            Áreas
          </button>
        }
      </nav>

      @if (activeTab() === 'org') {
        <jt-org-chart (nodeSelected)="openFromOrgChart($event)" />
      }

      @if (activeTab() === 'areas' && canManage()) {
        <jt-areas-manager></jt-areas-manager>
      }

      <!-- Area filter (above the directory only) -->
      @if (activeTab() === 'directory' && areas().length > 0) {
        <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/70">
          <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Filtrar por área</span>
          <p-multiselect
            [ngModel]="selectedAreas()"
            (ngModelChange)="selectedAreas.set($event)"
            [options]="areaFilterOptions()"
            optionLabel="label"
            optionValue="value"
            [filter]="false"
            display="chip"
            [showClear]="true"
            placeholder="Todas las áreas"
            appendTo="body"
            styleClass="min-w-[18rem]"
          />
          @if (selectedAreas().length > 0) {
            <button type="button"
                    (click)="selectedAreas.set([])"
                    class="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <i class="pi pi-times text-[10px] mr-1" aria-hidden="true"></i>
              Limpiar
            </button>
          }
        </div>
      }

      <!-- LIST view (default) -->
      @if (activeTab() === 'directory' && viewMode() === 'list') {
        <section class="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-200/70" aria-label="Employee table">
          @if (filtered().length === 0) {
            <p class="px-4 py-12 text-center text-sm text-slate-400 italic">No hay empleados que coincidan con la búsqueda.</p>
          } @else {
            <div role="table" class="text-sm">
              <div
                role="row"
                class="grid grid-cols-[3rem_minmax(0,14rem)_minmax(0,14rem)_minmax(0,12rem)_minmax(0,10rem)_minmax(0,10rem)_8rem_8rem_minmax(0,8rem)_5rem]
                       gap-3 items-center px-4 py-3 bg-slate-50 border-b border-slate-200
                       text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold"
              >
                <span role="columnheader"></span>
                <span role="columnheader">Nombre</span>
                <span role="columnheader">Email</span>
                <span role="columnheader">Puesto</span>
                <span role="columnheader">Departamento</span>
                <span role="columnheader">Área</span>
                <span role="columnheader">Código</span>
                <span role="columnheader">Ingreso</span>
                <span role="columnheader">Rol</span>
                <span role="columnheader" class="text-right">Acciones</span>
              </div>
              <div role="rowgroup" class="h-[calc(100vh-18rem)] min-h-[24rem]">
                <jt-virtual-list [items]="filtered()" [itemSize]="56" [trackByKey]="'id'">
                  <ng-template #row let-emp>
                    <div
                      role="row"
                      class="grid grid-cols-[3rem_minmax(0,14rem)_minmax(0,14rem)_minmax(0,12rem)_minmax(0,10rem)_minmax(0,10rem)_8rem_8rem_minmax(0,8rem)_5rem]
                             gap-3 items-center px-4 py-2.5 border-b border-slate-100
                             cursor-pointer transition-colors hover:bg-violet-50/40"
                      (click)="open(emp)"
                      (keydown.enter)="open(emp)"
                      tabindex="0"
                    >
                      <span role="cell">
                        <span class="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold"
                              [style.background]="avatarBg(emp.id)"
                              [style.color]="avatarFg(emp.id)">
                          @if (emp.avatarUrl) {
                            <img [src]="emp.avatarUrl" alt="" class="h-full w-full rounded-full object-cover" />
                          } @else {
                            {{ initials(emp.displayName) }}
                          }
                        </span>
                      </span>
                      <span role="cell">
                        <p class="font-semibold text-slate-950 truncate">{{ emp.displayName }}</p>
                      </span>
                      <span role="cell" class="text-slate-600 truncate">{{ emp.email }}</span>
                      <span role="cell" class="text-slate-700 truncate">{{ emp.position || '—' }}</span>
                      <span role="cell" class="text-slate-600 truncate">{{ emp.department || '—' }}</span>
                      <span role="cell">
                        @if (areaOf(emp); as area) {
                          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                [style.background]="area.color + '20'"
                                [style.color]="area.color">
                            @if (isPiIcon(area.icon)) {
                              <i [class]="'pi ' + area.icon + ' text-[9px]'" aria-hidden="true"></i>
                            } @else if (area.icon) {
                              <span aria-hidden="true">{{ area.icon }}</span>
                            }
                            <span class="truncate max-w-[8rem]">{{ area.name }}</span>
                          </span>
                        } @else {
                          <span class="text-[11px] text-slate-300">—</span>
                        }
                      </span>
                      <span role="cell" class="font-mono text-xs text-slate-500 truncate">{{ emp.employeeCode || '—' }}</span>
                      <span role="cell" class="text-xs text-slate-500 whitespace-nowrap">
                        {{ emp.hireDate ? (emp.hireDate | date:'mediumDate') : '—' }}
                      </span>
                      <span role="cell" (click)="$event.stopPropagation()">
                        @if (editingRoleFor() === emp.id) {
                          <p-select
                            [ngModel]="emp.workspaceRole"
                            (ngModelChange)="onRoleChange(emp, $event)"
                            [options]="roleOptions"
                            optionLabel="label"
                            optionValue="value"
                            appendTo="body"
                            [disabled]="updatingRole()"
                            styleClass="text-xs"
                          />
                        } @else {
                          <div class="flex items-center gap-1.5">
                            <span [class]="'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ' + roleBadgeClass(emp.workspaceRole)">
                              <span aria-hidden="true">{{ roleBadgeIcon(emp.workspaceRole) }}</span>
                              <span>{{ roleBadgeLabel(emp.workspaceRole) }}</span>
                            </span>
                            @if (canEditRoleOf(emp)) {
                              <button type="button"
                                      (click)="startEditRole(emp); $event.stopPropagation()"
                                      class="rounded p-1 text-slate-400 transition hover:bg-violet-50 hover:text-violet-700"
                                      [attr.aria-label]="'Editar rol de ' + emp.displayName">
                                <i class="pi pi-pencil text-[10px]" aria-hidden="true"></i>
                              </button>
                            }
                          </div>
                        }
                      </span>
                      <span role="cell" class="text-right">
                        <button type="button" (click)="open(emp); $event.stopPropagation()"
                                class="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700"
                                aria-label="Editar">
                          <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                        </button>
                      </span>
                    </div>
                  </ng-template>
                </jt-virtual-list>
              </div>
            </div>
          }
        </section>
      } @else if (activeTab() === 'directory' && viewMode() === 'grid') {
        <!-- GRID view -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Employee grid">
          @for (emp of filtered(); track emp.id) {
            <article
              class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 transition-shadow hover:shadow-md hover:shadow-violet-200/60 cursor-pointer"
              (click)="open(emp)"
              (keydown.enter)="open(emp)"
              tabindex="0"
              role="button"
              [attr.aria-label]="'Abrir perfil de ' + emp.displayName"
            >
              <div class="flex items-start gap-4">
                <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                      [style.background]="avatarBg(emp.id)"
                      [style.color]="avatarFg(emp.id)">
                  @if (emp.avatarUrl) {
                    <img [src]="emp.avatarUrl" alt="" class="h-full w-full rounded-2xl object-cover" />
                  } @else {
                    {{ initials(emp.displayName) }}
                  }
                </span>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate text-base font-bold text-slate-950">{{ emp.displayName }}</h3>
                  <p class="truncate text-xs text-slate-500">{{ emp.email }}</p>
                  @if (emp.position) {
                    <p class="mt-2 text-xs text-slate-700"><i class="pi pi-briefcase text-[10px] mr-1" aria-hidden="true"></i>{{ emp.position }}</p>
                  }
                  @if (emp.department) {
                    <p class="text-xs text-slate-500"><i class="pi pi-building text-[10px] mr-1" aria-hidden="true"></i>{{ emp.department }}</p>
                  }
                  @if (areaOf(emp); as area) {
                    <span class="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          [style.background]="area.color + '20'"
                          [style.color]="area.color">
                      @if (isPiIcon(area.icon)) {
                        <i [class]="'pi ' + area.icon + ' text-[9px]'" aria-hidden="true"></i>
                      } @else if (area.icon) {
                        <span aria-hidden="true">{{ area.icon }}</span>
                      }
                      {{ area.name }}
                    </span>
                  }
                </div>
                <span [class]="'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ' + roleBadgeClass(emp.workspaceRole)">
                  <span aria-hidden="true">{{ roleBadgeIcon(emp.workspaceRole) }}</span>
                  <span>{{ roleBadgeLabel(emp.workspaceRole) }}</span>
                </span>
              </div>
            </article>
          } @empty {
            <div class="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <p class="text-sm text-slate-500">No hay empleados que coincidan con la búsqueda.</p>
            </div>
          }
        </section>
      }

      <!-- Detail / edit panel -->
      @if (selected(); as emp) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          (click)="close()"
        >
          <div
            class="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
            (click)="$event.stopPropagation()"
          >
            <header class="mb-5 flex items-start justify-between gap-4">
              <div class="flex items-center gap-4">
                <span
                  class="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
                  [style.background]="avatarBg(emp.id)"
                  [style.color]="avatarFg(emp.id)"
                >
                  @if (emp.avatarUrl) {
                    <img [src]="emp.avatarUrl" alt="" class="h-full w-full rounded-2xl object-cover" />
                  } @else {
                    {{ initials(emp.displayName) }}
                  }
                </span>
                <div>
                  <h2 class="text-xl font-black text-slate-950">{{ emp.displayName }}</h2>
                  <p class="text-sm text-slate-500">{{ emp.email }}</p>
                  @if (canEdit(emp)) {
                    <button
                      type="button"
                      (click)="fileInput.click()"
                      class="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700"
                    >
                      <i class="pi pi-camera text-[10px]" aria-hidden="true"></i>
                      Cambiar foto
                    </button>
                    <input
                      #fileInput
                      type="file"
                      accept="image/*"
                      class="hidden"
                      (change)="onAvatarSelected($event, emp)"
                    />
                  }
                </div>
              </div>
              <button
                type="button"
                (click)="close()"
                class="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cerrar"
              >
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </header>

            @if (canEdit(emp)) {
              <form (ngSubmit)="save(emp)" class="flex flex-col gap-4">
                <p-tabs [value]="activeEditTab()" (valueChange)="activeEditTab.set($any($event))">
                  <p-tablist>
                    <p-tab value="personal">
                      <i class="pi pi-user text-[10px] mr-1.5" aria-hidden="true"></i>
                      Personal
                    </p-tab>
                    <p-tab value="work">
                      <i class="pi pi-briefcase text-[10px] mr-1.5" aria-hidden="true"></i>
                      Trabajo
                    </p-tab>
                    @if (canManage()) {
                      <p-tab value="reports">
                        <i class="pi pi-sitemap text-[10px] mr-1.5" aria-hidden="true"></i>
                        Reportes
                      </p-tab>
                    }
                    <p-tab value="notes">
                      <i class="pi pi-pencil text-[10px] mr-1.5" aria-hidden="true"></i>
                      Notas
                    </p-tab>
                  </p-tablist>

                  <p-tabpanels>
                    <p-tabpanel value="personal">
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                        <label class="flex flex-col gap-1">
                          <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Nombre</span>
                          <input type="text" [(ngModel)]="form.displayName" name="displayName"
                                 class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                        </label>
                        <label class="flex flex-col gap-1">
                          <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Email</span>
                          <input type="email" [(ngModel)]="form.email" name="email"
                                 class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                        </label>
                        <label class="flex flex-col gap-1">
                          <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teléfono</span>
                          <input type="tel" [(ngModel)]="form.phone" name="phone"
                                 class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                        </label>
                        <label class="flex flex-col gap-1">
                          <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Fecha de nacimiento</span>
                          <input type="date" [(ngModel)]="form.birthDate" name="birthDate"
                                 class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                        </label>
                        <label class="sm:col-span-2 flex flex-col gap-1">
                          <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Dirección</span>
                          <input type="text" [(ngModel)]="form.address" name="address"
                                 class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                        </label>
                      </div>
                    </p-tabpanel>

                    <p-tabpanel value="work">
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                        @if (canManage()) {
                          <label class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Código de empleado</span>
                            <input type="text" [(ngModel)]="form.employeeCode" name="employeeCode"
                                   class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                          </label>
                          <label class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Estado</span>
                            <p-select
                              [(ngModel)]="form.status"
                              name="status"
                              [options]="statusOptions"
                              optionLabel="label"
                              optionValue="value"
                              appendTo="body"
                            />
                          </label>
                          <label class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Puesto</span>
                            <input type="text" [(ngModel)]="form.position" name="position"
                                   class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                          </label>
                          <label class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Departamento</span>
                            <input type="text" [(ngModel)]="form.department" name="department"
                                   class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                          </label>
                          <label class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Área</span>
                            <p-select
                              [ngModel]="form.areaId ?? null"
                              (ngModelChange)="form.areaId = $event"
                              name="areaId"
                              [options]="areaSelectOptions()"
                              optionLabel="label"
                              optionValue="value"
                              appendTo="body"
                              [showClear]="true"
                              placeholder="Sin área"
                            />
                          </label>
                          <label class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Fecha de ingreso</span>
                            <input type="date" [(ngModel)]="form.hireDate" name="hireDate"
                                   class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                          </label>
                        } @else {
                          <p class="sm:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                            Solo administradores pueden modificar la información laboral.
                          </p>
                        }
                      </div>
                    </p-tabpanel>

                    @if (canManage()) {
                      <p-tabpanel value="reports">
                        <div class="grid grid-cols-1 gap-4 pt-3">
                          <label class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Reporta a</span>
                            <p-multiselect
                              [ngModel]="reportsTo()"
                              (ngModelChange)="reportsTo.set($event)"
                              name="reportsTo"
                              [options]="supervisorOptions(emp.id)"
                              optionLabel="label"
                              optionValue="value"
                              [filter]="true"
                              display="chip"
                              [showClear]="true"
                              placeholder="Sin supervisores"
                              appendTo="body"
                              styleClass="w-full"
                            />
                            <span class="text-[10px] text-slate-400">Una persona puede reportar a varios líderes.</span>
                          </label>
                        </div>
                      </p-tabpanel>
                    }

                    <p-tabpanel value="notes">
                      <div class="grid grid-cols-1 gap-4 pt-3">
                        <label class="flex flex-col gap-1">
                          <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Contacto de emergencia</span>
                          <input type="text" [(ngModel)]="form.emergencyContact" name="emergencyContact" placeholder="Nombre y teléfono"
                                 class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                        </label>
                        <label class="flex flex-col gap-1">
                          <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Bio / notas</span>
                          <textarea rows="5" [(ngModel)]="form.bio" name="bio"
                                    class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"></textarea>
                        </label>
                      </div>
                    </p-tabpanel>
                  </p-tabpanels>
                </p-tabs>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button type="button" (click)="close()"
                          class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                    Cancelar
                  </button>
                  <button type="submit" [disabled]="saving()"
                          class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">
                    @if (saving()) {
                      <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i> Guardando…
                    } @else {
                      <i class="pi pi-check text-xs" aria-hidden="true"></i> Guardar
                    }
                  </button>
                </div>
              </form>
            } @else {
              <!-- Read-only view -->
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Puesto</dt><dd class="text-slate-900">{{ emp.position || '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Departamento</dt><dd class="text-slate-900">{{ emp.department || '—' }}</dd></div>
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Área</dt>
                  <dd>
                    @if (areaOf(emp); as area) {
                      <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                            [style.background]="area.color + '20'"
                            [style.color]="area.color">
                        @if (isPiIcon(area.icon)) {
                          <i [class]="'pi ' + area.icon + ' text-[10px]'" aria-hidden="true"></i>
                        } @else if (area.icon) {
                          <span aria-hidden="true">{{ area.icon }}</span>
                        }
                        {{ area.name }}
                      </span>
                    } @else {
                      <span class="text-slate-400">—</span>
                    }
                  </dd>
                </div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Teléfono</dt><dd class="text-slate-900">{{ emp.phone || '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Código</dt><dd class="text-slate-900 font-mono">{{ emp.employeeCode || '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ingreso</dt><dd class="text-slate-900">{{ emp.hireDate ? (emp.hireDate | date) : '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nacimiento</dt><dd class="text-slate-900">{{ emp.birthDate ? (emp.birthDate | date) : '—' }}</dd></div>
                <div class="sm:col-span-2"><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dirección</dt><dd class="text-slate-900">{{ emp.address || '—' }}</dd></div>
                <div class="sm:col-span-2"><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Emergencia</dt><dd class="text-slate-900">{{ emp.emergencyContact || '—' }}</dd></div>
                <div class="sm:col-span-2">
                  <dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reporta a</dt>
                  <dd class="text-slate-900">
                    @if (supervisorsForRead(emp.id).length === 0) {
                      <span class="text-slate-400">—</span>
                    } @else {
                      <span class="flex flex-wrap gap-1.5">
                        @for (s of supervisorsForRead(emp.id); track s.id) {
                          <span class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                            <i class="pi pi-user text-[9px]" aria-hidden="true"></i>{{ s.displayName }}
                          </span>
                        }
                      </span>
                    }
                  </dd>
                </div>
                @if (emp.bio) {
                  <div class="sm:col-span-2"><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bio</dt><dd class="text-slate-900 whitespace-pre-wrap">{{ emp.bio }}</dd></div>
                }
              </dl>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class EmployeesComponent implements OnInit {
  private readonly api = inject(EmployeeApiService);
  private readonly orgGraphApi = inject(OrgGraphApiService);
  private readonly areaStore = inject(AreaStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly initials = initials;

  /** Exposed to the template so the chip renderer can pick `pi-*` vs emoji. */
  protected readonly isPiIcon = (icon: string | null): boolean =>
    !!icon && icon.trim().startsWith('pi-');

  readonly employees = signal<Employee[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly selected = signal<Employee | null>(null);
  readonly search = signal('');
  readonly viewMode = signal<'list' | 'grid'>('list');
  readonly activeTab = signal<'directory' | 'org' | 'areas'>('directory');
  /** Active tab inside the edit-employee modal. */
  readonly activeEditTab = signal<'personal' | 'work' | 'reports' | 'notes'>('personal');
  readonly editingRoleFor = signal<string | null>(null);
  readonly updatingRole = signal(false);
  /** Selected area ids for the directory filter — empty = no filter. */
  readonly selectedAreas = signal<string[]>([]);
  /** Convenience signal that exposes the shared area cache to the template. */
  readonly areas = this.areaStore.areas;

  /**
   * Reporting edges loaded from the workspace org-graph. Tracked here (not
   * inside `OrgChartComponent`) so the edit panel can read + diff them when
   * the admin saves a profile. Key = subordinate userId. Value = array of
   * supervisor userIds.
   */
  readonly supervisorsBySubordinate = signal<Map<string, string[]>>(new Map());

  /**
   * Working copy of the "Reporta a" multi-select while the panel is open.
   * Captured on `open(emp)` so we can compute a diff on save without mutating
   * the cached graph.
   */
  readonly reportsTo = signal<string[]>([]);
  private originalReportsTo: string[] = [];

  protected readonly statusOptions = [
    { label: 'Activo', value: 'active' },
    { label: 'Deshabilitado', value: 'disabled' },
  ];

  protected readonly roleOptions = [
    { label: 'Owner', value: 'owner' as const },
    { label: 'Admin', value: 'admin' as const },
    { label: 'Member', value: 'member' as const },
  ];

  form: UpdateEmployeeBody = {};

  readonly canManage = computed(() => this.auth.currentUser()?.role === 'admin');

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const areas = this.selectedAreas();
    const areaSet = new Set(areas);
    return this.employees().filter((e) => {
      if (areas.length > 0 && !areaSet.has(e.areaId ?? '')) return false;
      if (!q) return true;
      return (
        e.displayName?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q)
      );
    });
  });

  /**
   * `<p-multiselect>` options for the area filter — pulled from the shared
   * `AreaStore`. We expose the empty "Sin área" pseudo-id so admins can
   * surface employees that haven't been assigned yet.
   */
  readonly areaFilterOptions = computed(() => {
    const opts = this.areas().map((a) => ({ label: a.name, value: a.id }));
    return [{ label: 'Sin área', value: '' }, ...opts];
  });

  /** `<p-select>` options for the edit panel — includes a `null` clear-out. */
  readonly areaSelectOptions = computed<{ label: string; value: string | null }[]>(() => {
    return [
      { label: 'Sin área', value: null },
      ...this.areas().map((a) => ({ label: a.name, value: a.id })),
    ];
  });

  /** Resolves an employee's areaId to the actual Area object (or null). */
  areaOf(emp: Employee): Area | null {
    if (!emp.areaId) return null;
    return this.areaStore.byId()[emp.areaId] ?? null;
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
    // Load org graph + areas in parallel; failure shouldn't block the
    // directory view, both surface their own toasts on error.
    void this.reloadOrgGraph();
    void this.reloadAreas();
  }

  async reloadAreas(): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) return;
    try {
      await this.areaStore.load(workspaceId);
    } catch {
      // Quiet — area badges just won't render until the admin retries.
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.api.list();
      this.employees.set(list);
    } catch {
      this.toast.error('No pudimos cargar los empleados');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Refreshes the supervisors map from the backend org-graph. Used both at
   * boot and after any add/remove report mutation so the edit panel reflects
   * the new edges without a full page reload.
   */
  async reloadOrgGraph(): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) return;
    try {
      const graph = await this.orgGraphApi.getOrgGraph(workspaceId);
      const map = new Map<string, string[]>();
      for (const e of graph.edges) {
        if (!map.has(e.from)) map.set(e.from, []);
        map.get(e.from)!.push(e.to);
      }
      this.supervisorsBySubordinate.set(map);
    } catch {
      // Quiet failure — the org graph tab will surface its own error.
    }
  }

  canEdit(emp: Employee): boolean {
    return this.canManage() || this.auth.currentUser()?.id === emp.id;
  }

  /**
   * Called when the user clicks a node in the org chart. Switches to the
   * directory tab and opens the edit modal for that employee.
   */
  openFromOrgChart(userId: string): void {
    const emp = this.employees().find((e) => e.id === userId);
    if (!emp) return;
    this.activeTab.set('directory');
    this.open(emp);
  }

  open(emp: Employee): void {
    this.selected.set(emp);
    this.activeEditTab.set('personal');
    this.form = {
      displayName: emp.displayName ?? '',
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      position: emp.position ?? '',
      department: emp.department ?? '',
      hireDate: emp.hireDate ?? '',
      birthDate: emp.birthDate ?? '',
      address: emp.address ?? '',
      bio: emp.bio ?? '',
      employeeCode: emp.employeeCode ?? '',
      emergencyContact: emp.emergencyContact ?? '',
      areaId: emp.areaId ?? null,
      status: emp.status ?? 'active',
    };
    // Snapshot the supervisor selection so the diff on save is stable.
    const current = this.supervisorsBySubordinate().get(emp.id) ?? [];
    this.originalReportsTo = [...current];
    this.reportsTo.set([...current]);
  }

  close(): void {
    this.selected.set(null);
    this.reportsTo.set([]);
    this.originalReportsTo = [];
  }

  /**
   * Options for the "Reporta a" multi-select. Excludes the employee being
   * edited so admins can't accidentally create a self-report (the backend
   * would reject it anyway, but we hide it for UX).
   */
  supervisorOptions(employeeId: string): { label: string; value: string }[] {
    return this.employees()
      .filter((e) => e.id !== employeeId)
      .map((e) => ({ label: e.displayName, value: e.id }));
  }

  /**
   * Resolves the supervisor ids of `employeeId` to actual employee records
   * for the read-only view. Stale ids (employee no longer in the workspace)
   * are filtered out.
   */
  supervisorsForRead(employeeId: string): Employee[] {
    const ids = this.supervisorsBySubordinate().get(employeeId) ?? [];
    const byId = new Map(this.employees().map((e) => [e.id, e] as const));
    return ids.map((id) => byId.get(id)).filter((e): e is Employee => !!e);
  }

  async save(emp: Employee): Promise<void> {
    this.saving.set(true);
    try {
      // Convert empty strings to null so the backend clears the column rather
      // than storing literal empty strings.
      const patch: UpdateEmployeeBody = {};
      for (const [k, v] of Object.entries(this.form)) {
        if (v === '' || v === undefined) (patch as Record<string, unknown>)[k] = null;
        else (patch as Record<string, unknown>)[k] = v;
      }
      const updated = await this.api.update(emp.id, patch);
      this.employees.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
      this.selected.set(updated);

      // Apply reports-to diff after the profile patch — admins only. Failures
      // here surface a separate toast so the user knows the profile saved
      // even if the graph mutation didn't.
      if (this.canManage()) {
        await this.applyReportsDiff(emp.id);
      }

      this.toast.success('Cambios guardados');
      // Close the modal on success — the user said it should auto-dismiss.
      // On error the modal stays open so the user can retry.
      this.close();
    } catch (err) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail ?? 'No pudimos guardar';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Diff `reportsTo()` against the snapshot taken in `open()`. Issues one
   * `addReport` per new supervisor and one `removeReport` per removed
   * supervisor, in parallel. The backend rejects self-reports and direct
   * cycles — those errors surface as per-edge toasts but DON'T block the
   * other mutations from going through.
   */
  private async applyReportsDiff(employeeId: string): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) return;
    const before = new Set(this.originalReportsTo);
    const after = new Set(this.reportsTo());
    const added = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));
    if (added.length === 0 && removed.length === 0) return;

    const calls: Promise<unknown>[] = [];
    for (const supervisorId of added) {
      calls.push(
        this.orgGraphApi
          .addReport(workspaceId, employeeId, supervisorId)
          .catch((err) => {
            const msg =
              (err as { error?: { detail?: string; message?: string } })?.error
                ?.detail ?? 'No pudimos agregar un supervisor';
            this.toast.error(msg);
          }),
      );
    }
    for (const supervisorId of removed) {
      calls.push(
        this.orgGraphApi
          .removeReport(workspaceId, employeeId, supervisorId)
          .catch((err) => {
            const msg =
              (err as { error?: { detail?: string; message?: string } })?.error
                ?.detail ?? 'No pudimos quitar un supervisor';
            this.toast.error(msg);
          }),
      );
    }
    await Promise.all(calls);
    // Refresh cache so the read-only view, the chart tab, and the next
    // `open()` snapshot see the new edges.
    await this.reloadOrgGraph();
    this.originalReportsTo = [...this.reportsTo()];
  }

  async onAvatarSelected(event: Event, emp: Employee): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.api.uploadAvatar(emp.id, file);
      this.toast.success('Foto actualizada');
      await this.reload();
      // Refresh the selected reference so the new avatar appears in the panel.
      const fresh = this.employees().find((e) => e.id === emp.id);
      if (fresh) this.selected.set(fresh);
    } catch (err) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail ?? 'No pudimos subir la foto';
      this.toast.error(msg);
    } finally {
      // Clear the input so picking the same file again fires `change`.
      input.value = '';
    }
  }

  avatarBg(id: string): string {
    // Pastel-ish — high lightness + moderate saturation gives a soft fill
    // that pairs well with dark initials on top. Hue is hashed so each user
    // gets a stable but different color.
    return `hsl(${hashHue(id)}, 55%, 88%)`;
  }

  avatarFg(id: string): string {
    // Matching deeper tone for the initials/text inside the pastel circle.
    return `hsl(${hashHue(id)}, 35%, 35%)`;
  }

  roleBadgeClass(role: string): string {
    // High-contrast role badges per the spec — owner stands out as the
    // privileged role, member is intentionally muted.
    if (role === 'owner') return 'bg-violet-100 text-violet-800 font-bold';
    if (role === 'admin') return 'bg-indigo-100 text-indigo-700';
    if (role === 'guest') return 'bg-slate-50 text-slate-500 border border-slate-200';
    return 'bg-slate-100 text-slate-600';
  }

  roleBadgeIcon(role: string): string {
    if (role === 'owner') return '👑';
    if (role === 'admin') return '⚡';
    if (role === 'guest') return '👤';
    return '👤';
  }

  roleBadgeLabel(role: string): string {
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin';
    if (role === 'guest') return 'Guest';
    return 'Member';
  }

  /**
   * Role-edit affordance only appears when the current user can manage
   * the workspace AND the row is not their own (changing your own role
   * is forbidden server-side anyway).
   */
  canEditRoleOf(emp: Employee): boolean {
    if (!this.canManage()) return false;
    return this.auth.currentUser()?.id !== emp.id;
  }

  startEditRole(emp: Employee): void {
    if (!this.canEditRoleOf(emp)) return;
    this.editingRoleFor.set(emp.id);
  }

  cancelEditRole(): void {
    this.editingRoleFor.set(null);
  }

  async onRoleChange(
    emp: Employee,
    newRole: 'owner' | 'admin' | 'member',
  ): Promise<void> {
    if (newRole === emp.workspaceRole) {
      this.cancelEditRole();
      return;
    }
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) {
      this.toast.error('No hay workspace activo');
      return;
    }
    this.updatingRole.set(true);
    try {
      await this.api.updateRole(workspaceId, emp.id, newRole);
      // Optimistically reflect the change in the local list.
      this.employees.update((list) =>
        list.map((e) =>
          e.id === emp.id ? { ...e, workspaceRole: newRole } : e,
        ),
      );
      this.toast.success('Rol actualizado');
    } catch (err) {
      const msg =
        (err as { error?: { detail?: string; message?: string } })?.error
          ?.detail ??
        (err as { error?: { message?: string } })?.error?.message ??
        'No pudimos actualizar el rol';
      this.toast.error(msg);
    } finally {
      this.updatingRole.set(false);
      this.cancelEditRole();
    }
  }
}
