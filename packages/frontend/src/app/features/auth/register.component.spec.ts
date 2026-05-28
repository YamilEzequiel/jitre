import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { Router, provideRouter } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { provideTranslateService, TranslateLoader, TranslateNoOpLoader } from '@ngx-translate/core';
import { ProjectStore } from '../../stores/project.store';
import { TaskStore } from '../../stores/task.store';
import { NotificationStore } from '../../stores/notification.store';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let registerMock: ReturnType<typeof vi.fn>;
  let loginMock: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registerMock = vi.fn().mockResolvedValue(undefined);
    loginMock = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: TranslateNoOpLoader },
        }),
        { provide: AuthService, useValue: { register: registerMock, login: loginMock, currentWorkspace: () => null } },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
        { provide: ProjectStore, useValue: { onWorkspaceSwitch: vi.fn().mockResolvedValue(undefined) } },
        { provide: TaskStore, useValue: { onWorkspaceSwitch: vi.fn().mockResolvedValue(undefined) } },
        { provide: NotificationStore, useValue: { onWorkspaceSwitch: vi.fn().mockResolvedValue(undefined) } },
      ],
    });

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the i18n keys for register copy', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('auth.register.subtitle');
    expect(text).toContain('auth.register.termsLink');
  });

  it('auto-logins and redirects after successful registration', async () => {
    const comp = fixture.componentInstance;
    comp.form.setValue({
      name: 'Test User',
      email: 'user@test.com',
      password: 'secure123',
      confirmPassword: 'secure123',
      acceptTerms: true,
    });
    await comp.submit();
    expect(loginMock).toHaveBeenCalledWith({ email: 'user@test.com', password: 'secure123' });
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('does not submit if passwords do not match', async () => {
    const comp = fixture.componentInstance;
    comp.form.setValue({
      name: 'Test',
      email: 'u@t.com',
      password: 'abc12345',
      confirmPassword: 'xyz45678',
      acceptTerms: true,
    });
    await comp.submit();
    expect(registerMock).not.toHaveBeenCalled();
  });
});
