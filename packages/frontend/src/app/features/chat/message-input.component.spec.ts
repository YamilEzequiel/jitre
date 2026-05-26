import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageInputComponent } from './message-input.component';

describe('MessageInputComponent', () => {
  let fixture: ComponentFixture<MessageInputComponent>;
  let component: MessageInputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MessageInputComponent] }).compileComponents();
    fixture = TestBed.createComponent(MessageInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('canSend is false when value is empty', () => {
    component.value.set('');
    expect(component.canSend()).toBe(false);
    component.value.set('   ');
    expect(component.canSend()).toBe(false);
    component.value.set('hi');
    expect(component.canSend()).toBe(true);
  });

  it('emits sent and clears value on send()', () => {
    const sent: string[] = [];
    component.sent.subscribe(v => sent.push(v));
    component.value.set('hello world');
    component.send();
    expect(sent).toEqual(['hello world']);
    expect(component.value()).toBe('');
  });

  it('does not emit when only whitespace', () => {
    const sent: string[] = [];
    component.sent.subscribe(v => sent.push(v));
    component.value.set('   ');
    component.send();
    expect(sent).toEqual([]);
  });

  it('emits typingStart on first input and typingStop on debounce', async () => {
    vi.useFakeTimers();
    const start: number[] = [];
    const stop: number[] = [];
    component.typingStart.subscribe(() => start.push(1));
    component.typingStop.subscribe(() => stop.push(1));
    component.value.set('a');
    component.onInput();
    expect(start.length).toBe(1);
    expect(stop.length).toBe(0);
    vi.advanceTimersByTime(1100);
    expect(stop.length).toBe(1);
    vi.useRealTimers();
  });

  it('clearing input stops typing', () => {
    const stop: number[] = [];
    component.typingStop.subscribe(() => stop.push(1));
    component.value.set('a');
    component.onInput();
    component.value.set('');
    component.onInput();
    expect(stop.length).toBe(1);
  });
});
