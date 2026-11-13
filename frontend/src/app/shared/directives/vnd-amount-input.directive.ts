import { Directive, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

import { caretAfterDigits, formatVndInput } from '../utils/vnd-amount';

const digitsOf = (value: string): string => value.replace(/\D/g, '');

/**
 * Groups a whole-VND amount with thousands separators while it is typed (`1250000` -> `1,250,000`), so large amounts
 * are easy to read. The caret stays after the same digit, and the bound form control receives the grouped text,
 * which `normalizeVndInput` turns back into plain digits before any request.
 *
 * Backspace / Delete on a separator removes the digit next to it, otherwise regrouping would put the comma straight
 * back and the key would appear to do nothing.
 *
 * Nothing is rewritten while an IME composition is open (Vietnamese Telex/VNI, Windows' built-in Vietnamese keyboard,
 * CJK input...). Changing the value mid-composition makes the browser commit the composed text a second time, so
 * `5000 000` typed with such a keyboard turned into `5,000,000,000`. The field is formatted once on `compositionend`.
 */
@Directive({
  selector: 'input[appVndAmountInput]',
  host: {
    '(beforeinput)': 'onBeforeInput()',
    '(input)': 'onInput($event)',
    '(compositionstart)': 'onCompositionStart()',
    '(compositionend)': 'onCompositionEnd()'
  }
})
export class VndAmountInputDirective {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  /** Field value just before the current edit, so a separator-only deletion can be recognised. */
  private previous: string | null = null;
  private composing = false;

  onBeforeInput(): void {
    this.previous = this.element.nativeElement.value;
  }

  onCompositionStart(): void {
    this.composing = true;
  }

  onCompositionEnd(): void {
    this.composing = false;
    this.previous = null;
    this.onInput();
  }

  onInput(event?: Event): void {
    if (this.composing || (event instanceof InputEvent && event.isComposing)) {
      return;
    }
    const input = this.element.nativeElement;
    let raw = input.value;
    let caret = input.selectionStart ?? raw.length;

    const inputType = event instanceof InputEvent ? event.inputType : '';
    const previous = this.previous;
    this.previous = null;
    if (
      previous !== null &&
      raw !== previous &&
      digitsOf(raw) === digitsOf(previous) &&
      (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward')
    ) {
      // Only a separator was removed: drop the digit before (Backspace) or after (Delete) the caret instead.
      const index = inputType === 'deleteContentBackward' ? caret - 1 : caret;
      if (index >= 0 && index < raw.length) {
        raw = raw.slice(0, index) + raw.slice(index + 1);
        caret = inputType === 'deleteContentBackward' ? index : caret;
      }
    }

    const formatted = formatVndInput(raw);
    if (formatted === input.value) {
      return;
    }

    // Leading zeros that formatting drops sit before the caret too, so they must not count as digits it keeps.
    const allDigits = digitsOf(raw);
    const strippedZeros = allDigits.length - allDigits.replace(/^0+(?=\d)/, '').length;
    const digitsBeforeCaret = Math.max(0, digitsOf(raw.slice(0, caret)).length - strippedZeros);

    input.value = formatted;
    this.ngControl?.control?.setValue(formatted, { emitModelToViewChange: false });

    const position = caretAfterDigits(formatted, digitsBeforeCaret);
    if (document.activeElement === input) {
      input.setSelectionRange(position, position);
    }
  }
}
