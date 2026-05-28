import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CheckboxComponent } from './checkbox.component';

@Component({
  imports: [CheckboxComponent, ReactiveFormsModule],
  template: `<jt-checkbox [formControl]="control" />`,
})
class FormHostComponent {
  readonly control = new FormControl(false);
}

@Component({
  imports: [CheckboxComponent],
  template: `<jt-checkbox [checked]="value" (checkedChange)="value = $event" />`,
})
class CheckedHostComponent {
  value = false;
}

function inputEl(fixture: ComponentFixture<unknown>): HTMLInputElement {
  return fixture.nativeElement.querySelector('input[type="checkbox"]')!;
}

describe('CheckboxComponent', () => {
  describe('Reactive Forms binding', () => {
    let fixture: ComponentFixture<FormHostComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [FormHostComponent] });
      fixture = TestBed.createComponent(FormHostComponent);
      fixture.detectChanges();
    });

    it('reflects FormControl initial value of false', () => {
      expect(inputEl(fixture).checked).toBe(false);
    });

    it('reflects FormControl.setValue(true) after first render — regression for formAttached signal', () => {
      // This is the exact bug the user hit on settings panels:
      // patchValue / setValue fired AFTER the computed had already evaluated
      // with formAttached=false, so the conditional branch never tracked
      // internalChecked and the checkbox stayed visually unchecked.
      fixture.componentInstance.control.setValue(true);
      fixture.detectChanges();
      expect(inputEl(fixture).checked).toBe(true);
    });

    it('reflects FormControl.setValue back to false', () => {
      fixture.componentInstance.control.setValue(true);
      fixture.detectChanges();
      fixture.componentInstance.control.setValue(false);
      fixture.detectChanges();
      expect(inputEl(fixture).checked).toBe(false);
    });
  });

  describe('[checked] / (checkedChange) binding', () => {
    let fixture: ComponentFixture<CheckedHostComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [CheckedHostComponent] });
      fixture = TestBed.createComponent(CheckedHostComponent);
      fixture.detectChanges();
    });

    it('reflects initial false', () => {
      expect(inputEl(fixture).checked).toBe(false);
    });

    it('reflects parent toggle to true', () => {
      fixture.componentInstance.value = true;
      fixture.detectChanges();
      expect(inputEl(fixture).checked).toBe(true);
    });

    it('does NOT render an inner <label> when no [label] input is set', () => {
      // Regression: nested labels (consumer wraps jt-checkbox in <label>)
      // cause double-toggle on text-click in browsers. The settings panels
      // and pickers all rely on the consumer-provided outer label, so the
      // component must skip its own label when there's no inline text to
      // wrap.
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('label')).toBeNull();
      // The visual wrapper is still there as a <span>.
      expect(host.querySelector('span input[type="checkbox"]')).toBeTruthy();
    });
  });

  describe('label rendering', () => {
    @Component({
      imports: [CheckboxComponent],
      template: `<jt-checkbox [checked]="false" label="Pick me" />`,
    })
    class LabeledHostComponent {}

    it('DOES render an inner <label> when [label] is set (login pattern)', () => {
      TestBed.configureTestingModule({ imports: [LabeledHostComponent] });
      const fixture = TestBed.createComponent(LabeledHostComponent);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const label = host.querySelector('label');
      expect(label).toBeTruthy();
      expect(label?.textContent).toContain('Pick me');
    });
  });
});
