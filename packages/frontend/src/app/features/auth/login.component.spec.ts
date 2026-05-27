import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { Router, provideRouter } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { provideTranslateService, TranslateNoOpLoader, TranslateLoader } from '@ngx-translate/core';
import { ProjectStore } from '../../stores/project.store';
import { TaskStore } from '../../stores/task.store';
import { NotificationStore } from '../../stores/notification.store';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let loginMock: ReturnType<typeof vi.fn>;
  let errorToastMock: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loginMock = vi.fn().mockResolvedValue(undefined);
    errorToastMock = vi.fn();

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: TranslateNoOpLoader },
        }),
        { provide: AuthService, useValue: { login: loginMock, currentWorkspace: () => null } },
        { provide: ToastService, useValue: { error: errorToastMock, success: vi.fn() } },
        { provide: ProjectStore, useValue: { onWorkspaceSwitch: vi.fn().mockResolvedValue(undefined) } },
        { provide: TaskStore, useValue: { onWorkspaceSwitch: vi.fn().mockResolvedValue(undefined) } },
        { provide: NotificationStore, useValue: { onWorkspaceSwitch: vi.fn().mockResolvedValue(undefined) } },
      ],
    });

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('submit button is present', () => {
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button[type="submit"]');
    expect(btn).toBeTruthy();
  });

  it('calls auth.login with credentials on valid submit', async () => {
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'test@test.com', password: 'password123', rememberMe: false });
    await comp.submit();
    expect(loginMock).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password123' });
  });

  it('navigates to / on success', async () => {
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'a@b.com', password: 'pw1234', rememberMe: false });
    await comp.submit();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('calls ToastService.error on login failure', async () => {
    loginMock.mockRejectedValue({ status: 401, error: { title: 'Invalid credentials' } });
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'a@b.com', password: 'wrongpassword', rememberMe: false });
    await comp.submit();
    expect(errorToastMock).toHaveBeenCalled();
  });
});
