import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import {
  MAX_DESCRIPTION_LENGTH,
  descriptionValidator,
  expenseDateValidator,
  formatExpenseDate,
  parseExpenseDate
} from './expense-form';

describe('parseExpenseDate', () => {
  it.each<[string, { year: number; month: number }]>([
    ['2026-09-15', { year: 2026, month: 9 }],
    ['2026-01-01', { year: 2026, month: 1 }],
    ['2026-12-31', { year: 2026, month: 12 }],
    ['2026-01-31', { year: 2026, month: 1 }],
    ['2026-04-30', { year: 2026, month: 4 }],
    ['2026-02-28', { year: 2026, month: 2 }]
  ])('returns the plan period for %s', (value, period) => {
    expect(parseExpenseDate(value)).toEqual(period);
  });

  it('accepts the leap day of a leap year (TC_F3_010)', () => {
    expect(parseExpenseDate('2024-02-29')).toEqual({ year: 2024, month: 2 });
  });

  it('accepts the leap day of a year divisible by 400', () => {
    expect(parseExpenseDate('2000-02-29')).toEqual({ year: 2000, month: 2 });
  });

  it.each(['2026-02-29', '1900-02-29', '2100-02-29'])('rejects a leap day in a non-leap year: %s', (value) => {
    expect(parseExpenseDate(value)).toBeNull();
  });

  it.each(['2026-13-01', '2026-00-10', '2026-99-01'])('rejects an invalid month: %s', (value) => {
    expect(parseExpenseDate(value)).toBeNull();
  });

  it.each(['2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31', '2026-01-32', '2026-02-30', '2026-01-00'])(
    'rejects a day that the month does not have: %s',
    (value) => {
      expect(parseExpenseDate(value)).toBeNull();
    }
  );

  it.each(['', ' ', '2026-4-1', '2026-04-1', '2026-4-01', '26-04-01', '2026/04/01', '04-01-2026', 'abc'])(
    'rejects text that is not YYYY-MM-DD: %j',
    (value) => {
      expect(parseExpenseDate(value)).toBeNull();
    }
  );

  it.each([' 2026-09-15', '2026-09-15 ', '2026-09-15T00:00:00', '2026-09-15\n', '12026-09-15', '2026-09'])(
    'rejects extra characters around the date: %j',
    (value) => {
      expect(parseExpenseDate(value)).toBeNull();
    }
  );

  it('rejects non-ASCII digits', () => {
    expect(parseExpenseDate('２０２６-０９-１５')).toBeNull();
    expect(parseExpenseDate('٢٠٢٦-٠٩-١٥')).toBeNull();
  });

  it('rejects year 0000 and accepts year 0001, the API year range', () => {
    expect(parseExpenseDate('0000-01-01')).toBeNull();
    expect(parseExpenseDate('0001-01-01')).toEqual({ year: 1, month: 1 });
  });

  it('keeps the year as written, without the two-digit-year mapping of the Date constructor', () => {
    expect(parseExpenseDate('0005-03-10')).toEqual({ year: 5, month: 3 });
    expect(parseExpenseDate('9999-12-31')).toEqual({ year: 9999, month: 12 });
  });
});

describe('formatExpenseDate', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(formatExpenseDate(new Date(2026, 8, 15))).toBe('2026-09-15');
  });

  it('zero-pads the month and the day', () => {
    expect(formatExpenseDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatExpenseDate(new Date(2026, 2, 9))).toBe('2026-03-09');
  });

  it('formats the last day of the year', () => {
    expect(formatExpenseDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('keeps the local day right after midnight and right before the next midnight', () => {
    // `toISOString` would give the previous day for the first case in a timezone ahead of UTC (for example UTC+7).
    expect(formatExpenseDate(new Date(2026, 9, 1, 0, 0, 1))).toBe('2026-10-01');
    expect(formatExpenseDate(new Date(2026, 8, 30, 23, 59, 59))).toBe('2026-09-30');
  });

  it('formats the leap day', () => {
    expect(formatExpenseDate(new Date(2024, 1, 29))).toBe('2024-02-29');
  });

  it.each<[number, string]>([
    [5, '0005-01-01'],
    [99, '0099-01-01'],
    [999, '0999-01-01'],
    [1, '0001-01-01']
  ])('pads a year below 1000 to four digits: %i', (year, expected) => {
    const date = new Date(2000, 0, 1);
    // `setFullYear` is used because `new Date(5, 0, 1)` silently becomes year 1905.
    date.setFullYear(year, 0, 1);

    expect(formatExpenseDate(date)).toBe(expected);
  });

  it('produces a value that parseExpenseDate accepts', () => {
    const value = formatExpenseDate(new Date(2026, 8, 15));

    expect(parseExpenseDate(value)).toEqual({ year: 2026, month: 9 });
  });
});

describe('expenseDateValidator', () => {
  const validate = (value: unknown) => expenseDateValidator(new FormControl(value));

  it.each(['2026-09-15', '2024-02-29', '0001-01-01'])('accepts %j', (value) => {
    expect(validate(value)).toBeNull();
  });

  it.each(['', '2026-02-29', '2026-13-01', '2026-04-31', '2026-4-1', '0000-01-01', 'abc'])(
    'returns expenseDate for %j',
    (value) => {
      expect(validate(value)).toEqual({ expenseDate: true });
    }
  );

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a number', 20260915],
    ['a Date object', new Date(2026, 8, 15)],
    ['an object', {}]
  ])('rejects a non-string control value: %s', (_label, value) => {
    expect(validate(value)).toEqual({ expenseDate: true });
  });

  it('updates control validity with the value', () => {
    const control = new FormControl('', { nonNullable: true, validators: [expenseDateValidator] });
    expect(control.hasError('expenseDate')).toBe(true);

    control.setValue('2026-09-15');
    expect(control.valid).toBe(true);

    control.setValue('2026-02-30');
    expect(control.hasError('expenseDate')).toBe(true);
  });
});

describe('descriptionValidator', () => {
  const validate = (value: unknown) => descriptionValidator(new FormControl(value));

  it('limits the description to 500 characters', () => {
    expect(MAX_DESCRIPTION_LENGTH).toBe(500);
  });

  it.each(['a', 'Weekly groceries', '  Weekly groceries  ', '\tTaxi\n'])('accepts %j', (value) => {
    expect(validate(value)).toBeNull();
  });

  it.each(['', ' ', '     ', '\t', '\n', ' \t\n '])('returns required for blank text: %j', (value) => {
    expect(validate(value)).toEqual({ required: true });
  });

  it('accepts exactly 500 characters', () => {
    expect(validate('a'.repeat(500))).toBeNull();
  });

  it('returns maxlength for 501 characters', () => {
    expect(validate('a'.repeat(501))).toEqual({ maxlength: true });
  });

  it('counts the trimmed text: 500 characters plus padding spaces are accepted', () => {
    expect(validate(`${' '.repeat(10)}${'a'.repeat(500)}${' '.repeat(10)}`)).toBeNull();
  });

  it('still rejects 501 characters when padded with spaces', () => {
    expect(validate(` ${'a'.repeat(501)} `)).toEqual({ maxlength: true });
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a number', 5],
    ['an object', {}]
  ])('treats a non-string control value as required: %s', (_label, value) => {
    expect(validate(value)).toEqual({ required: true });
  });

  it('updates control validity with the value', () => {
    const control = new FormControl('', { nonNullable: true, validators: [descriptionValidator] });
    expect(control.hasError('required')).toBe(true);

    control.setValue('Weekly groceries');
    expect(control.valid).toBe(true);

    control.setValue('a'.repeat(501));
    expect(control.hasError('maxlength')).toBe(true);
  });
});
