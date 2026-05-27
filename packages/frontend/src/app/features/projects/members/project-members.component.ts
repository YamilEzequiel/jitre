import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';

type ProjectRole = 'admin' | 'contributor' | 'viewer';

interface ProjectMember {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: ProjectRole;
}

interface WorkspaceContact {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

@Component({
  selector: 'jt-project-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule],
  template: `
    <div>
      <div class="mb-5 flex items-center justify-between">
        <div>
          <h2 class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Members</h2>
          <p class="mt-1 text-sm text-slate-500">Definí quién administra, colabora o sólo consulta este proyecto.</p>
        </div>
        <button
          type="button"
          (click)="openInvite()"
          class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition-shadow hover:shadow-lg hover:shadow-indigo-500/40"
        >
          <span aria-hidden="true">+</span>
          Add Member
        </button>
      </div>

      <div class="mb-5 grid gap-2 text-xs sm:grid-cols-3">
        <p class="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-indigo-900"><strong>Admin</strong> · gestiona miembros y workflow</p>
        <p class="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-violet-900"><strong>Contributor</strong> · crea y actualiza trabajo</p>
        <p class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"><strong>Viewer</strong> · sólo lectura</p>
      </div>

      <div class="space-y-2">
        @for (member of members(); track member.userId) {
          <div class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-violet-200 hover:bg-violet-50">
            <div class="flex min-w-0 items-center gap-3">
              <div class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                {{ displayName(member).charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-slate-950">{{ displayName(member) }}</p>
                <p class="truncate text-[11px] text-slate-500">{{ member.email || member.userId }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <p-select
                [options]="roleOptions"
                [ngModel]="member.role"
                (ngModelChange)="changeRole(member, $event)"
                optionLabel="label"
                optionValue="value"
                size="small"
                appendTo="body"
                [attr.aria-label]="'Role for ' + displayName(member)"
              />
              <button
                type="button"
                (click)="removeMember(member)"
                [attr.aria-label]="'Remove ' + displayName(member)"
                class="text-xs font-semibold text-rose-600 transition-colors hover:text-rose-700"
              >
                Remove
              </button>
            </div>
          </div>
        } @empty {
          <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <p class="text-sm text-slate-500">No members yet.</p>
          </div>
        }
      </div>

      @if (showInvite()) {
        <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Add project member">
          <section class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-base font-bold text-slate-950">Add member</h3>
              <button type="button" (click)="showInvite.set(false)" aria-label="Close" class="text-slate-500 hover:text-slate-900">✕</button>
            </div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500" for="member-user">Person</label>
            <p-select
              inputId="member-user"
              [options]="contactOptions()"
              [ngModel]="inviteUserId()"
              (ngModelChange)="inviteUserId.set($event)"
              optionLabel="label"
              optionValue="value"
              placeholder="Select a workspace member"
              appendTo="body"
              styleClass="mb-4 w-full"
            />
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500" for="member-role">Project role</label>
            <p-select
              inputId="member-role"
              [options]="inviteRoleOptions"
              [ngModel]="inviteRole()"
              (ngModelChange)="inviteRole.set($event)"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              styleClass="mb-5 w-full"
            />
            <div class="flex justify-end gap-2">
              <button type="button" (click)="showInvite.set(false)" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="button" [disabled]="!inviteUserId() || saving()" (click)="addMember()" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add</button>
            </div>
          </section>
        </div>
      }
    </div>
  `,
})
export class ProjectMembersComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly members = signal<ProjectMember[]>([]);
  readonly contacts = signal<WorkspaceContact[]>([]);
  readonly showInvite = signal(false);
  readonly inviteUserId = signal('');
  readonly inviteRole = signal<ProjectRole>('contributor');
  readonly saving = signal(false);
  readonly availableContacts = computed(() => {
    const memberIds = new Set(this.members().map(member => member.userId));
    return this.contacts().filter(contact => !memberIds.has(contact.userId));
  });

  readonly contactOptions = computed(() =>
    this.availableContacts().map(c => ({
      label: `${c.displayName} · ${c.email}`,
      value: c.userId,
    })),
  );

  readonly roleOptions: { label: string; value: ProjectRole }[] = [
    { label: 'Admin', value: 'admin' },
    { label: 'Contributor', value: 'contributor' },
    { label: 'Viewer', value: 'viewer' },
  ];

  readonly inviteRoleOptions: { label: string; value: ProjectRole }[] = [
    { label: 'Contributor', value: 'contributor' },
    { label: 'Viewer', value: 'viewer' },
    { label: 'Admin', value: 'admin' },
  ];

  ngOnInit(): void {
    this.loadMembers();
  }

  private loadMembers(): void {
    this.http.get<ProjectMember[]>(`/api/v1/projects/${this.projectId()}/members`).subscribe({
      next: members => this.members.set(members),
      error: () => this.toast.error('Failed to load members'),
    });
  }

  openInvite(): void {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) {
      this.toast.error('No active workspace selected');
      return;
    }
    this.showInvite.set(true);
    this.http.get<WorkspaceContact[]>(`/api/v1/workspaces/${workspaceId}/members`).subscribe({
      next: contacts => this.contacts.set(contacts),
      error: () => this.toast.error('Failed to load workspace members'),
    });
  }

  addMember(): void {
    const userId = this.inviteUserId();
    if (!userId) return;
    this.saving.set(true);
    this.http.post(`/api/v1/projects/${this.projectId()}/members`, {
      userId,
      role: this.inviteRole(),
    }).subscribe({
      next: () => {
        this.loadMembers();
        this.showInvite.set(false);
        this.inviteUserId.set('');
        this.inviteRole.set('contributor');
        this.saving.set(false);
        this.toast.success('Member added');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Failed to add member');
      },
    });
  }

  removeMember(member: ProjectMember): void {
    this.http.delete(`/api/v1/projects/${this.projectId()}/members/${member.userId}`).subscribe({
      next: () => {
        this.members.update(members => members.filter(current => current.userId !== member.userId));
        this.toast.success('Member removed');
      },
      error: (error: HttpErrorResponse) => this.handleRoleError(error, 'Failed to remove member'),
    });
  }

  changeRole(member: ProjectMember, role: ProjectRole): void {
    const previousRole = member.role;
    this.members.update(members =>
      members.map(current => current.userId === member.userId ? { ...current, role } : current),
    );
    this.http.patch(`/api/v1/projects/${this.projectId()}/members/${member.userId}`, { role }).subscribe({
      next: () => this.toast.success('Role updated'),
      error: (error: HttpErrorResponse) => {
        this.members.update(members =>
          members.map(current => current.userId === member.userId ? { ...current, role: previousRole } : current),
        );
        this.handleRoleError(error, 'Failed to update role');
      },
    });
  }

  displayName(member: ProjectMember): string {
    return member.displayName || member.email || member.userId.slice(0, 8);
  }

  private handleRoleError(error: HttpErrorResponse, fallback: string): void {
    if (error.error?.detail === 'LAST_PROJECT_ADMIN') {
      this.toast.error('The project must keep at least one admin');
      return;
    }
    this.toast.error(fallback);
  }
}
