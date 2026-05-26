import {
  Directive,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  inject,
  input,
} from '@angular/core';
import { KeyboardShortcutService } from '../../core/keyboard/keyboard-shortcut.service';

@Directive({
  selector: '[jtShortcut]',
})
export class ShortcutDirective implements OnInit, OnDestroy {
  private readonly shortcuts = inject(KeyboardShortcutService);

  readonly jtShortcut = input.required<string>();

  @Output() readonly jtShortcutTriggered = new EventEmitter<KeyboardEvent>();

  private _unregister?: () => void;

  ngOnInit(): void {
    this._unregister = this.shortcuts.register({
      key: this.jtShortcut(),
      handler: (event: KeyboardEvent) => this.jtShortcutTriggered.emit(event),
    });
  }

  ngOnDestroy(): void {
    this._unregister?.();
  }
}
