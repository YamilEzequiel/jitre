import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let requestResetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestResetMock = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { requestReset: requestResetMock } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls auth.requestReset on submit', async () => {
    const comp = fixture.componentInstance;
    comp.form.setValue({ email: 'user@test.com' });
    await comp.submit();
    expect(requestResetMock).toHaveBeenCalledWith('user@test.com');
  });
});
