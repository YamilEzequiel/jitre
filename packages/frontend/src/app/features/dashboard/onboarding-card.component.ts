import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProjectStore } from '../../stores/project.store';
import { TaskStore } from '../../stores/task.store';

interface OnboardingStep {
  done: boolean;
  label: string;
  hint: string;
  cta: string;
  link: string;
  icon: string;
}

/**
 * Shown ONLY when the workspace is empty (no projects, no tasks). Walks
 * a new user through 3 quick actions so they don't land on a void
 * dashboard. Hides itself as soon as any of the actions is taken.
 */
@Component({
  selector: 'jt-onboarding-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [RouterLink],
  template: `
    @if (visible()) {
      <section
        class="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-sm shadow-indigo-200/40"
      >
        <header class="space-y-1.5">
          <div class="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/60 px-3 py-0.5">
            <span class="pi pi-sparkles text-[10px] text-indigo-600" aria-hidden="true"></span>
            <span class="text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-700">
              Empezá aquí
            </span>
          </div>
          <h2 class="text-xl font-black tracking-tight text-slate-950">
            Workspace listo — faltan 3 pasos
          </h2>
          <p class="text-sm text-slate-600 max-w-2xl">
            Te dejamos un workspace vacío para que arranques. En menos de un minuto vas a tener un primer proyecto, una tarea creada y todo el flujo andando.
          </p>
        </header>

        <ol class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          @for (step of steps(); track step.label; let i = $index) {
            <li
              class="rounded-xl border bg-white p-4 transition-colors"
              [class.border-emerald-200]="step.done"
              [class.bg-emerald-50]="step.done"
              [class.border-slate-200]="!step.done"
            >
              <div class="mb-2 flex items-center gap-2">
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black"
                  [class.bg-emerald-500]="step.done"
                  [class.text-white]="step.done"
                  [class.bg-indigo-100]="!step.done"
                  [class.text-indigo-700]="!step.done"
                >
                  @if (step.done) {
                    <i class="pi pi-check text-[9px]" aria-hidden="true"></i>
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                <h3 class="text-sm font-bold text-slate-950">{{ step.label }}</h3>
              </div>
              <p class="text-xs text-slate-500 leading-relaxed">{{ step.hint }}</p>
              @if (!step.done) {
                <a
                  [routerLink]="step.link"
                  class="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700"
                >
                  <i [class]="'pi ' + step.icon + ' text-[10px]'" aria-hidden="true"></i>
                  {{ step.cta }}
                </a>
              }
            </li>
          }
        </ol>
      </section>
    }
  `,
})
export class OnboardingCardComponent {
  private readonly projectStore = inject(ProjectStore);
  private readonly taskStore = inject(TaskStore);

  readonly hasProjects = computed(() => this.projectStore.items().length > 0);
  readonly hasTasks = computed(() => Object.keys(this.taskStore.byId()).length > 0);

  readonly steps = computed<OnboardingStep[]>(() => [
    {
      done: this.hasProjects(),
      label: 'Crear primer proyecto',
      hint: 'Los proyectos agrupan tareas, tienen workflow propio y son la base de todo lo demás.',
      cta: 'Nuevo proyecto',
      link: '/projects',
      icon: 'pi-folder-open',
    },
    {
      done: this.hasTasks(),
      label: 'Sumar una tarea',
      hint: 'Probá la IA: en task detail tenés "AI Describe" para que escriba la descripción por vos.',
      cta: 'Ver proyectos',
      link: '/projects',
      icon: 'pi-list-check',
    },
    {
      done: false, // we don't track invites here yet; nudges the user anyway
      label: 'Invitar al equipo',
      hint: 'Sumá compañeros desde Settings → Workspace. Sin equipo, perdés todo el realtime y los comentarios.',
      cta: 'Ir a Settings',
      link: '/settings',
      icon: 'pi-users',
    },
  ]);

  /**
   * Visible only when the workspace looks fresh (no projects AND no
   * tasks). Once the user creates anything, the card disappears.
   */
  readonly visible = computed(() => !this.hasProjects() && !this.hasTasks());
}
