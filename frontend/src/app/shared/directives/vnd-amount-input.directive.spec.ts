import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VndAmountInputDirective } from './vnd-amount-input.directive';

@Component({
  imports: [ReactiveFormsModule, VndAmountInputDirective],
  template: `
    <input class="bound" type="text" appVndAmountInput [formControl]="amount" />
    <input class="plain" type="text" appVndAmountInput />
  `
})
class HostComponent {
  readonly amount = new FormControl('', { nonNullable: true });
}

type DeleteType = 'deleteContentBackward' | 'deleteContentForward';

interface Field {
  fixture: ComponentFixture<HostComponent>;
  input: HTMLInputElement;
  control: FormControl<string>;
}

const setup = (selector = 'input.bound'): Field => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(selector);
  if (input === null) {
    throw new Error(`No ${selector} rendered`);
  }
  return { fixture, input, control: fixture.componentInstance.amount };
};

/** Simulates typing / pasting: the browser has already changed the value, then fires a plain `input` event. */
const type = (input: HTMLInputElement, value: string, caret = value.length): void => {
  input.value = value;
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new Event('input'));
};

/**
 * Simulates Backspace / Delete the way a browser does: `beforeinput` while the old value is still in the field, then
 * the browser's edit (`after`, caret at `caret`), then an `input` InputEvent carrying the edit type.
 */
const deleteKey = (input: HTMLInputElement, inputType: DeleteType, after: string, caret: number): void => {
  input.dispatchEvent(new InputEvent('beforeinput', { inputType, cancelable: true }));
  input.value = after;
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new InputEvent('input', { inputType }));
};

/** Puts a value in the field without the directive seeing it, as if it was already formatted. */
const prefill = (input: HTMLInputElement, value: string): void => {
  input.value = value;
};

describe('VndAmountInputDirective', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatting while typing', () => {
    it('groups thousands in the field and in the bound control', () => {
      const { input, control } = setup();

      type(input, '1250000');

      expect(input.value).toBe('1,250,000');
      expect(control.value).toBe('1,250,000');
    });

    it.each([
      ['abc12x3', '123'],
      ['1.250.000', '1,250,000'],
      ['-25000', '25,000'],
      ['1 000', '1,000']
    ])('strips non-digits: %j -> %j', (raw, expected) => {
      const { input, control } = setup();

      type(input, raw);

      expect(input.value).toBe(expected);
      expect(control.value).toBe(expected);
    });

    it.each([
      ['0001250', '1,250'],
      ['01', '1'],
      ['000', '0']
    ])('strips leading zeros but keeps a lone zero: %j -> %j', (raw, expected) => {
      const { input, control } = setup();

      type(input, raw);

      expect(input.value).toBe(expected);
      expect(control.value).toBe(expected);
    });

    it('clears the field when only non-digits were typed', () => {
      const { input, control } = setup();

      type(input, 'abc');

      expect(input.value).toBe('');
      expect(control.value).toBe('');
    });

    it('regroups after a digit is inserted in the middle', () => {
      const { input, control } = setup();
      prefill(input, '1,250');

      type(input, '1,2550', 4);

      expect(input.value).toBe('12,550');
      expect(control.value).toBe('12,550');
    });

    it('does nothing when the value is already formatted', () => {
      const { input, control } = setup();
      input.focus();
      const select = vi.spyOn(input, 'setSelectionRange');

      input.value = '1,250,000';
      input.dispatchEvent(new Event('input'));

      expect(input.value).toBe('1,250,000');
      expect(control.value).toBe('1,250,000');
      expect(select).not.toHaveBeenCalled();
    });

    it('does nothing for an empty field', () => {
      const { input, control } = setup();

      type(input, '');

      expect(input.value).toBe('');
      expect(control.value).toBe('');
    });

    it('marks the control dirty through the normal value accessor and keeps it in sync on every keystroke', () => {
      const { input, control } = setup();
      const values: string[] = [];
      control.valueChanges.subscribe((value) => values.push(value));

      type(input, '1');
      type(input, '12');
      type(input, '123');
      type(input, '1234');
      type(input, '1,2345');

      expect(input.value).toBe('12,345');
      expect(control.value).toBe('12,345');
      expect(control.dirty).toBe(true);
      expect(values.at(-1)).toBe('12,345');
    });

    it('formats an input that has no form control', () => {
      const { input, control } = setup('input.plain');

      type(input, '987654');

      expect(input.value).toBe('987,654');
      expect(control.value).toBe('');
    });
  });

  describe('caret', () => {
    it('keeps the caret after the same digit when the field is focused', () => {
      const { input } = setup();
      input.focus();

      // "1,2|345": the user typed a digit after "2"; regrouping moves the comma.
      type(input, '1,2345', 3);

      expect(input.value).toBe('12,345');
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
    });

    it('keeps the caret at the end after typing at the end', () => {
      const { input } = setup();
      input.focus();

      type(input, '1250000');

      expect(input.selectionStart).toBe('1,250,000'.length);
    });

    it('counts the caret without stripped leading zeros', () => {
      const { input } = setup();
      input.focus();

      // "00012|50": three leading zeros before the caret are about to be removed.
      type(input, '0001250', 5);

      expect(input.value).toBe('1,250');
      expect(input.selectionStart).toBe(3);
    });

    it('counts the caret without stripped non-digits', () => {
      const { input } = setup();
      input.focus();

      // "1x2|3456"
      type(input, '1x23456', 3);

      expect(input.value).toBe('123,456');
      expect(input.selectionStart).toBe(2);
    });

    it('does not move the selection when the field is not focused', () => {
      const { input } = setup();
      input.blur();
      const select = vi.spyOn(input, 'setSelectionRange');

      input.value = '1250000';
      input.dispatchEvent(new Event('input'));

      expect(input.value).toBe('1,250,000');
      expect(select).not.toHaveBeenCalled();
    });

    it('treats an unknown caret as the end of the value', () => {
      const { input } = setup();
      input.focus();
      input.value = '1250000';
      Object.defineProperty(input, 'selectionStart', { configurable: true, get: () => null });
      const select = vi.spyOn(input, 'setSelectionRange');

      input.dispatchEvent(new Event('input'));

      expect(input.value).toBe('1,250,000');
      expect(select).toHaveBeenCalledWith(9, 9);
    });
  });

  describe('Backspace / Delete next to a separator', () => {
    it('Backspace right after a comma removes the digit before it', () => {
      const { input, control } = setup();
      input.focus();
      prefill(input, '1,250');

      // "1,|250" + Backspace: the browser removes the comma, leaving "1|250".
      deleteKey(input, 'deleteContentBackward', '1250', 1);

      expect(input.value).toBe('250');
      expect(control.value).toBe('250');
      expect(input.selectionStart).toBe(0);
    });

    it('Delete right before a comma removes the digit after it', () => {
      const { input, control } = setup();
      input.focus();
      prefill(input, '1,250');

      // "1|,250" + Delete: the browser removes the comma, leaving "1|250".
      deleteKey(input, 'deleteContentForward', '1250', 1);

      expect(input.value).toBe('150');
      expect(control.value).toBe('150');
      expect(input.selectionStart).toBe(1);
    });

    it('Backspace after an inner comma regroups the remaining digits and keeps the caret after the same digit', () => {
      const { input, control } = setup();
      input.focus();
      prefill(input, '12,345,678');

      // "12,345,|678" + Backspace -> "12,345|678" -> the "5" is removed -> "1,234,678" with the caret after "4".
      deleteKey(input, 'deleteContentBackward', '12,345678', 6);

      expect(input.value).toBe('1,234,678');
      expect(control.value).toBe('1,234,678');
      expect(input.selectionStart).toBe(5);
    });

    it('Delete before an inner comma regroups the remaining digits and keeps the caret in place', () => {
      const { input } = setup();
      input.focus();
      prefill(input, '12,345,678');

      // "12,345|,678" + Delete -> "12,345|678" -> the "6" is removed -> "1,234,5|78": the caret stays after "5".
      deleteKey(input, 'deleteContentForward', '12,345678', 6);

      expect(input.value).toBe('1,234,578');
      expect(input.selectionStart).toBe(7);
    });

    it('a Backspace that removed a digit only regroups', () => {
      const { input, control } = setup();
      input.focus();
      prefill(input, '1,250');

      // "1,2|50" + Backspace -> "1,|50".
      deleteKey(input, 'deleteContentBackward', '1,50', 2);

      expect(input.value).toBe('150');
      expect(control.value).toBe('150');
      expect(input.selectionStart).toBe(1);
    });

    it('a Delete that removed a digit only regroups', () => {
      const { input } = setup();
      input.focus();
      prefill(input, '1,250');

      // "1,|250" + Delete -> "1,|50".
      deleteKey(input, 'deleteContentForward', '1,50', 2);

      expect(input.value).toBe('150');
      expect(input.selectionStart).toBe(1);
    });

    it('does nothing when the key changed nothing (Backspace at the start)', () => {
      const { input, control } = setup();
      prefill(input, '1,250');

      deleteKey(input, 'deleteContentBackward', '1,250', 0);

      expect(input.value).toBe('1,250');
      expect(control.value).toBe('1,250');
    });

    it('does not remove a digit when there is none before the caret', () => {
      const { input } = setup();
      prefill(input, ',1');

      deleteKey(input, 'deleteContentBackward', '1', 0);

      expect(input.value).toBe('1');
    });

    it('does not remove a digit when there is none after the caret', () => {
      const { input } = setup();
      prefill(input, '1,');

      deleteKey(input, 'deleteContentForward', '1', 1);

      expect(input.value).toBe('1');
    });

    it('only regroups a separator-only change that was not a deletion', () => {
      const { input } = setup();
      prefill(input, '1,250');

      // Typing a second comma: digits unchanged, but it is an insertion.
      input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: ',' }));
      input.value = '1,,250';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ',' }));

      expect(input.value).toBe('1,250');
    });

    it('only regroups a deletion that had no beforeinput', () => {
      const { input, control } = setup();

      input.value = '1250';
      input.setSelectionRange(1, 1);
      input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward' }));

      expect(input.value).toBe('1,250');
      expect(control.value).toBe('1,250');
    });

    it('only regroups a separator removal reported by a plain input event', () => {
      const { input } = setup();
      prefill(input, '1,250');

      input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward' }));
      input.value = '1250';
      input.setSelectionRange(1, 1);
      input.dispatchEvent(new Event('input'));

      expect(input.value).toBe('1,250');
    });

    it('forgets the pre-edit value after each input, so a later deletion without beforeinput is not misread', () => {
      const { input } = setup();
      prefill(input, '1,250');

      deleteKey(input, 'deleteContentBackward', '1250', 1);
      expect(input.value).toBe('250');

      // No beforeinput this time: the stored "1,250" must not be reused.
      input.value = '25';
      input.setSelectionRange(2, 2);
      input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward' }));

      expect(input.value).toBe('25');
    });
  });

  describe('IME composition (Vietnamese Telex / VNI keyboards)', () => {
    /** One composed word: the browser updates the field and fires `input` with `isComposing` for every key. */
    const compose = (input: HTMLInputElement, before: string, word: string): void => {
      input.dispatchEvent(new CompositionEvent('compositionstart'));
      for (let length = 1; length <= word.length; length++) {
        input.value = before + word.slice(0, length);
        input.setSelectionRange(input.value.length, input.value.length);
        input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', isComposing: true }));
      }
    };

    const endComposition = (input: HTMLInputElement): void => {
      input.dispatchEvent(new CompositionEvent('compositionend'));
    };

    it('does not rewrite the field while a composition is open', () => {
      const { input, control } = setup();
      input.focus();

      compose(input, '', '5000');

      expect(input.value).toBe('5000');
      expect(control.value).toBe('');
    });

    it('formats once when the composition ends', () => {
      const { input, control } = setup();
      input.focus();

      compose(input, '', '5000');
      endComposition(input);

      expect(input.value).toBe('5,000');
      expect(control.value).toBe('5,000');
      expect(input.selectionStart).toBe(5);
    });

    it('"5000 000" typed as two composed words becomes 5,000,000, not 5,000,000,000', () => {
      const { input, control } = setup();
      input.focus();

      compose(input, '', '5000');
      endComposition(input);
      compose(input, input.value, ' 000');
      endComposition(input);

      expect(input.value).toBe('5,000,000');
      expect(control.value).toBe('5,000,000');
    });

    it('still formats plain typing after a composition ended', () => {
      const { input } = setup();
      input.focus();

      compose(input, '', '12');
      endComposition(input);
      type(input, '12345');

      expect(input.value).toBe('12,345');
    });
  });
});
