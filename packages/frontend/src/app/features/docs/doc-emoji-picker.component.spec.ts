import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DocEmojiPickerComponent } from './doc-emoji-picker.component';

describe('DocEmojiPickerComponent', () => {
  let fixture: ComponentFixture<DocEmojiPickerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DocEmojiPickerComponent] });
    fixture = TestBed.createComponent(DocEmojiPickerComponent);
    fixture.detectChanges();
  });

  it('renders valid emoji page icons instead of mojibake', () => {
    const toggle = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('📄');
    expect(text).toContain('🚀');
    expect(text).not.toMatch(/â|ð|Â/);
  });
});
