import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  isDevMode,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { requestIdInterceptor } from './core/http/request-id.interceptor';
import { jwtInterceptor } from './core/http/jwt.interceptor';
import { csrfInterceptor } from './core/http/csrf.interceptor';
import { workspaceInterceptor } from './core/http/workspace.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { AuthService } from './core/auth/auth.service';
import { LocaleService, DEFAULT_LOCALE } from './core/i18n/locale.service';
import { ProjectStore } from './stores/project.store';
import { TaskStore } from './stores/task.store';
import { NotificationStore } from './stores/notification.store';
import { CommandPaletteService } from './shared/command-palette/command-palette.service';
import { NavigationProvider } from './shared/command-palette/providers/navigation.provider';
import { TaskSearchProvider } from './shared/command-palette/providers/task-search.provider';
import { ProjectSearchProvider } from './shared/command-palette/providers/project-search.provider';
import { DocumentSearchProvider } from './shared/command-palette/providers/document-search.provider';
import { CommentSearchProvider } from './shared/command-palette/providers/comment-search.provider';
import { AiActionProvider } from './shared/command-palette/providers/ai-action.provider';
import { SettingsProvider } from './shared/command-palette/providers/settings.provider';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([
        requestIdInterceptor,
        csrfInterceptor,
        workspaceInterceptor,
        jwtInterceptor,
        errorInterceptor,
      ]),
    ),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
          cssLayer: false,
        },
      },
    }),
    provideTranslateService({
      fallbackLang: DEFAULT_LOCALE,
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
    }),
    provideAppInitializer(() => {
      inject(LocaleService).init();
    }),
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const projects = inject(ProjectStore);
      const tasks = inject(TaskStore);
      const notifications = inject(NotificationStore);

      await auth.hydrate();
      const workspace = auth.currentWorkspace();
      if (workspace) {
        await Promise.allSettled([
          projects.onWorkspaceSwitch(workspace.id),
          tasks.onWorkspaceSwitch(workspace.id),
          notifications.onWorkspaceSwitch(workspace.id),
        ]);
      }
    }),
    provideAppInitializer(() => {
      const palette = inject(CommandPaletteService);
      palette.registerProvider(inject(NavigationProvider));
      palette.registerProvider(inject(TaskSearchProvider));
      palette.registerProvider(inject(ProjectSearchProvider));
      palette.registerProvider(inject(DocumentSearchProvider));
      palette.registerProvider(inject(CommentSearchProvider));
      palette.registerProvider(inject(AiActionProvider));
      palette.registerProvider(inject(SettingsProvider));
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
