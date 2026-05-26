import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiDescribeButtonComponent } from './ai-describe-button.component';
import { AiService } from '../../../core/ai/ai.service';
import { ToastService } from '../../../core/toast/toast.service';
import { signal } from '@angular/core';

describe('AiDescribeButtonComponent', () => {
  let fixture: ComponentFixture<AiDescribeButtonComponent>;
  let aiMock: { describeTask: ReturnType<typeof vi.fn>; loading: { describe: ReturnType<typeof signal> } };
  let toastMock: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    aiMock = {
      describeTask: vi.fn().mockResolvedValue({ description: 'AI description here' }),
      loading: { describe: signal(false) },
    };
    toastMock = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AiService, useValue: aiMock },
        { provide: ToastService, useValue: toastMock },
      ],
    });

    fixture = TestBed.createComponent(AiDescribeButtonComponent);
    fixture.componentRef.setInput('taskId', 't1');
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls AiService.describeTask on click', async () => {
    const comp = fixture.componentInstance;
    await comp.describe();
    expect(aiMock.describeTask).toHaveBeenCalledWith('t1');
  });

  it('emits described event with result', async () => {
    const spy = vi.fn();
    fixture.componentInstance.described.subscribe(spy);
    await fixture.componentInstance.describe();
    expect(spy).toHaveBeenCalledWith('AI description here');
  });

  it('shows loading state from AiService signal', () => {
    aiMock.loading.describe.set(true);
    expect(fixture.componentInstance.isLoading()).toBe(true);
  });
});
