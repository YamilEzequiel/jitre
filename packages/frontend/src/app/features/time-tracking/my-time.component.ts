import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TimeReportsComponent } from './time-reports.component';

/**
 * Thin wrapper around TimeReportsComponent that forces myTimeOnly=true.
 * Allows the same UI to power "/my-time" (member-accessible, scoped to current user)
 * and "/time-reports" (admin, cross-user).
 */
@Component({
  selector: 'jt-my-time',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimeReportsComponent],
  template: `<jt-time-reports [myTimeOnly]="true" />`,
})
export class MyTimeComponent {}
