import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

const loadAuthLayout = () =>
  import('./layouts/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent);

export const routes: Routes = [
  // Auth routes — each wrapped individually in AuthLayout so they don't
  // conflict with the protected `path: ''` MainLayout root.
  {
    path: 'login',
    loadComponent: loadAuthLayout,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
      },
    ],
  },
  {
    path: 'register',
    loadComponent: loadAuthLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/auth/register.component').then(m => m.RegisterComponent),
      },
    ],
  },
  {
    path: 'reset-password',
    loadComponent: loadAuthLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/auth/reset-password.component').then(m => m.ResetPasswordComponent),
      },
    ],
  },

  // Protected routes under MainLayout
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/list/project-list.component').then(
            m => m.ProjectListComponent,
          ),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./features/projects/detail/project-detail.component').then(
            m => m.ProjectDetailComponent,
          ),
      },
      {
        path: 'tasks/:id',
        loadComponent: () =>
          import('./features/tasks/detail/task-detail.component').then(m => m.TaskDetailComponent),
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/tickets/tickets-list.component').then(m => m.TicketsListComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notification-list.component').then(
            m => m.NotificationListComponent,
          ),
      },
      {
        path: 'time-reports',
        loadComponent: () =>
          import('./features/time-tracking/time-reports.component').then(
            m => m.TimeReportsComponent,
          ),
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./features/employees/employees.component').then(
            m => m.EmployeesComponent,
          ),
      },
      {
        path: 'my-time',
        loadComponent: () =>
          import('./features/time-tracking/my-time.component').then(
            m => m.MyTimeComponent,
          ),
      },
      {
        path: 'docs',
        loadComponent: () =>
          import('./features/docs/docs.component').then(m => m.DocsComponent),
        children: [
          {
            path: ':id',
            loadComponent: () =>
              import('./features/docs/doc-view.component').then(m => m.DocViewComponent),
          },
        ],
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/chat.component').then(m => m.ChatComponent),
        children: [
          {
            path: ':channelId',
            loadComponent: () =>
              import('./features/chat/chat-channel-view.component').then(
                m => m.ChatChannelViewComponent,
              ),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
