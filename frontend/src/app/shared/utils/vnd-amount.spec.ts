import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import {
  caretAfterDigits,
  describeVndInput,
  formatVndInput,
  isPositiveWholeVnd,
  isZeroWholeVnd,
  normalizeVndInput,
  positiveWholeVndValidator
} from './vnd-amount';

describe('normalizeVndInput', () => {
  it('removes comma grouping', () => {
    expect(normalizeVndInput('30,000,000')).toBe('30000000');
  });

  it('trims outer whitespace', () => {
    expect(normalizeVndInput('  25000000  ')).toBe('25000000');
    expect(normalizeVndInput('\t1,000\n')).toBe('1000');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeVndInput('')).toBe('');
    expect(normalizeVndInput('   ')).toBe('');
  });

  it.each([
    ['1.5', '1.5'],
    ['-1', '-1'],
    ['abc', 'abc'],
    ['1e3', '1e3'],
    ['25 000', '25 000']
  ])('keeps other characters so validation can reject them: %s', (input, expected) => {
    expect(normalizeVndInput(input)).toBe(expected);
  });

  it('does not treat dots as grouping', () => {
    expect(normalizeVndInput('30.000.000')).toBe('30.000.000');
  });

  it.each(['1,5', '1,0,0', '1000,000', ',,,', '1,00', '30,000,'])(
    'keeps commas that are not thousands grouping: %s',
    (input) => {
      expect(normalizeVndInput(input)).toBe(input);
      expect(isPositiveWholeVnd(normalizeVndInput(input))).toBe(false);
    }
  );
});

describe('isPositiveWholeVnd', () => {
  it.each(['1', '25000000', '9223372036854775807', '10', '100'])('accepts %s', (value) => {
    expect(isPositiveWholeVnd(value)).toBe(true);
  });

  it.each([
    '0',
    '000',
    '',
    '-1',
    '1.5',
    'abc',
    '1e3',
    ' 1',
    '1 ',
    '+1',
    '1,000',
    '١٢٣',
    '１２３',
    '9223372036854775808',
    '99999999999999999999999'
  ])('rejects %j', (value) => {
    expect(isPositiveWholeVnd(value)).toBe(false);
  });
});

describe('isZeroWholeVnd', () => {
  it.each(['0', '00', '000', '0000000000'])('is true for the all-zero digit string %j', (value) => {
    expect(isZeroWholeVnd(value)).toBe(true);
  });

  it.each(['1', '10', '100', '0001', '1000', '25000000', '9223372036854775807'])(
    'is false when a non-zero digit is present: %j',
    (value) => {
      expect(isZeroWholeVnd(value)).toBe(false);
    }
  );

  it.each(['', ' ', ' 0', '0 ', '-0', '+0', '0.0', '0.5', '0,000', 'abc', '0e0', '٠', '０'])(
    'is false for text that is not a plain digit string, so it keeps the generic invalid message: %j',
    (value) => {
      expect(isZeroWholeVnd(value)).toBe(false);
    }
  );

  it('tells "greater than zero" apart from "invalid" once the input is normalized', () => {
    expect(isZeroWholeVnd(normalizeVndInput('0,000'))).toBe(true);
    expect(isZeroWholeVnd(normalizeVndInput('  000  '))).toBe(true);
    expect(isZeroWholeVnd(normalizeVndInput('1,5'))).toBe(false);
  });

  it('is never true for a value that isPositiveWholeVnd accepts', () => {
    for (const value of ['1', '10', '9223372036854775807']) {
      expect(isPositiveWholeVnd(value)).toBe(true);
      expect(isZeroWholeVnd(value)).toBe(false);
    }
  });
});

describe('positiveWholeVndValidator', () => {
  const validate = (value: unknown) => positiveWholeVndValidator(new FormControl(value));

  it.each(['1', '25000000', '30,000,000', '  25000000  ', '9223372036854775807'])('accepts %j', (value) => {
    expect(validate(value)).toBeNull();
  });

  it.each(['', '  ', '0', '000', 'abc', '1.5', '-1', ',,,', '1e3', '9,223,372,036,854,775,808'])(
    'returns positiveVnd for %j',
    (value) => {
      expect(validate(value)).toEqual({ positiveVnd: true });
    }
  );

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a number', 25000000],
    ['a boolean', true],
    ['an object', {}]
  ])('rejects a non-string control value: %s', (_label, value) => {
    expect(validate(value)).toEqual({ positiveVnd: true });
  });

  it('works as a control validator and updates validity with the value', () => {
    const control = new FormControl('', { nonNullable: true, validators: [positiveWholeVndValidator] });
    expect(control.hasError('positiveVnd')).toBe(true);

    control.setValue('30,000,000');
    expect(control.valid).toBe(true);

    control.setValue('0');
    expect(control.hasError('positiveVnd')).toBe(true);
  });
});

describe('formatVndInput', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['999', '999'],
    ['1000', '1,000'],
    ['1250000', '1,250,000'],
    ['25000000', '25,000,000'],
    ['9223372036854775807', '9,223,372,036,854,775,807']
  ])('groups the digits of %j as %j', (raw, expected) => {
    expect(formatVndInput(raw)).toBe(expected);
  });

  it.each([
    ['1,250,000', '1,250,000'],
    ['1,2500', '12,500'],
    ['1,,000', '1,000'],
    ['abc12x3', '123'],
    [' 1 250 000 ', '1,250,000'],
    ['1.5', '15'],
    ['-1000', '1,000'],
    ['１２３', ''],
    ['abc', '']
  ])('keeps only ASCII digits and regroups them: %j -> %j', (raw, expected) => {
    expect(formatVndInput(raw)).toBe(expected);
  });

  it.each([
    ['0001250', '1,250'],
    ['01', '1'],
    ['0,001', '1'],
    ['0', '0'],
    ['000', '0']
  ])('drops leading zeros but keeps a lone zero: %j -> %j', (raw, expected) => {
    expect(formatVndInput(raw)).toBe(expected);
  });

  it('always produces text that normalizeVndInput turns back into the same plain digits', () => {
    for (const raw of ['1250000', '25,000,000', 'x1000y', '0009999999']) {
      const formatted = formatVndInput(raw);
      expect(normalizeVndInput(formatted)).toBe(formatted.replace(/,/g, ''));
    }
  });

  it('is idempotent', () => {
    expect(formatVndInput(formatVndInput('1234567'))).toBe('1,234,567');
  });
});

describe('caretAfterDigits', () => {
  it.each([
    ['1,250,000', 1, 1],
    ['1,250,000', 2, 3],
    ['1,250,000', 4, 5],
    ['1,250,000', 5, 7],
    ['1,250,000', 7, 9],
    ['12,345', 2, 2],
    ['12,345', 3, 4],
    ['123', 3, 3]
  ])('in %j puts the caret after digit %i at index %i', (formatted, digitCount, expected) => {
    expect(caretAfterDigits(formatted, digitCount)).toBe(expected);
  });

  it.each([0, -1])('returns 0 for a digit count of %i', (digitCount) => {
    expect(caretAfterDigits('1,250', digitCount)).toBe(0);
  });

  it('returns the end of the text when there are fewer digits than asked for', () => {
    expect(caretAfterDigits('1,250', 9)).toBe(5);
    expect(caretAfterDigits('', 2)).toBe(0);
  });
});

describe('describeVndInput', () => {
  it.each([
    ['1000', '≈ 1K VND'],
    ['1,234', '≈ 1.23K VND'],
    ['1,250,000', '≈ 1.25M VND'],
    ['25000000', '≈ 25M VND'],
    ['  30,000,000  ', '≈ 30M VND'],
    ['1234567890', '≈ 1.23B VND']
  ])('describes %j as %j', (raw, expected) => {
    expect(describeVndInput(raw)).toBe(expected);
  });

  it.each(['', '  ', '1', '999', '0', '0000', 'abc', '1.5', '-1000', '1,5', '9223372036854775808'])(
    'is empty for invalid input or amounts below one thousand: %j',
    (raw) => {
      expect(describeVndInput(raw)).toBe('');
    }
  );
});
