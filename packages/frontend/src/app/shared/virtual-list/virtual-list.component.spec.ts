import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { VirtualListComponent } from './virtual-list.component';

@Component({
  template: `
    <jt-virtual-list [items]="items" [itemSize]="48" [trackByKey]="'id'">
      <ng-template #row let-item>
        <div class="test-row">{{ item.name }}</div>
      </ng-template>
    </jt-virtual-list>
  `,
  imports: [VirtualListComponent],
})
class TestHostComponent {
  items = [{ id: '1', name: 'Alpha' }, { id: '2', name: 'Beta' }];
}

describe('VirtualListComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders host element', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('jt-virtual-list')).toBeTruthy();
  });

  it('accepts itemSize input without error', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('renders a virtual scroll viewport', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('cdk-virtual-scroll-viewport')).toBeTruthy();
  });
});
