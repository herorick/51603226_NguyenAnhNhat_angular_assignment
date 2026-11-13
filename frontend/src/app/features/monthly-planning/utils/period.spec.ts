import { FormControl } from '@angular/forms';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  currentMonthSpendingPath,
  currentPeriod,
  firstDayOfPeriod,
  formatPeriodInput,
  formatPeriodLabel,
  isSamePeriod,
  parsePeriod,
  parseRoutePeriod,
  periodValidator,
  shiftPeriod
} from './period';

describe('parseRoutePeriod', () => {
  it.each([
    ['2026', '9', { year: 2026, month: 9 }],
    ['2026', '12', { year: 2026, month: 12 }],
    ['1', '1', { year: 1, month: 1 }],
    ['9999', '12', { year: 9999, month: 12 }],
    ['2026', '09', { year: 2026, month: 9 }]
  ])('parses %s/%s', (year, month, expected) => {
    expect(parseRoutePeriod(year, month)).toEqual(expected);
  });

  it.each([
    ['a null year', null, '9'],
    ['a null month', '2026', null],
    ['year 0', '0', '9'],
    ['year above 9999', '10000', '9'],
    ['month 0', '2026', '0'],
    ['month 13', '2026', '13'],
    ['a non-numeric year', 'abc', '9'],
    ['a non-numeric month', '2026', 'xyz'],
    ['a decimal month', '2026', '1.5'],
    ['a negative month', '2026', '-1'],
    ['an exponent year', '1e3', '9'],
    ['an empty month', '2026', ''],
    ['a padded year', ' 2026', '9']
  ])('returns null for %s', (_label, year, month) => {
    expect(parseRoutePeriod(year, month)).toBeNull();
  });
});

describe('formatPeriodLabel', () => {
  it.each([
    [{ year: 2026, month: 1 }, 'January 2026'],
    [{ year: 2026, month: 9 }, 'September 2026'],
    [{ year: 2026, month: 12 }, 'December 2026'],
    [{ year: 5, month: 3 }, 'March 5']
  ])('formats %o as %s', (period, expected) => {
    expect(formatPeriodLabel(period)).toBe(expected);
  });
});

describe('firstDayOfPeriod', () => {
  it.each([
    [{ year: 2026, month: 9 }, '2026-09-01'],
    [{ year: 2026, month: 12 }, '2026-12-01'],
    [{ year: 5, month: 1 }, '0005-01-01']
  ])('builds the first day of %o', (period, expected) => {
    expect(firstDayOfPeriod(period)).toBe(expected);
  });
});

describe('parsePeriod', () => {
  it('parses an <input type="month"> value into numeric year and month', () => {
    expect(parsePeriod('2026-09')).toEqual({ year: 2026, month: 9 });
  });

  it.each([
    ['2026-01', { year: 2026, month: 1 }],
    ['2026-12', { year: 2026, month: 12 }],
    ['0001-01', { year: 1, month: 1 }],
    ['9999-12', { year: 9999, month: 12 }]
  ])('accepts the boundary %s', (value, expected) => {
    expect(parsePeriod(value)).toEqual(expected);
  });

  it.each([
    ['an empty string', ''],
    ['month 13', '2026-13'],
    ['month 00', '2026-00'],
    ['year 0000', '0000-05'],
    ['year above 9999', '10000-01'],
    ['a six digit year above 9999', '123456-01'],
    ['non-numeric text', 'abc'],
    ['a one digit month', '2026-9'],
    ['a three digit month', '2026-009'],
    ['a three digit year', '202-09'],
    ['a full date', '2026-09-01'],
    ['leading whitespace', ' 2026-09'],
    ['trailing whitespace', '2026-09 '],
    ['a slash separator', '2026/09'],
    ['a negative year', '-2026-09']
  ])('returns null for %s', (_label, value) => {
    expect(parsePeriod(value)).toBeNull();
  });
});

describe('periodValidator', () => {
  const validate = (value: unknown) => periodValidator(new FormControl(value));

  it('accepts a valid period', () => {
    expect(validate('2026-09')).toBeNull();
  });

  it.each<[string, unknown]>([
    ['an empty string', ''],
    ['month 13', '2026-13'],
    ['month 00', '2026-00'],
    ['year 10000', '10000-01'],
    ['null', null],
    ['undefined', undefined],
    ['a number', 202609],
    ['a Date', new Date(2026, 8, 1)]
  ])('returns { period: true } for %s', (_label, value) => {
    expect(validate(value)).toEqual({ period: true });
  });

  it('works as a control validator and updates validity with the value', () => {
    const control = new FormControl('2026-09', { nonNullable: true, validators: [periodValidator] });
    expect(control.valid).toBe(true);

    control.setValue('');
    expect(control.hasError('period')).toBe(true);

    control.setValue('2027-01');
    expect(control.valid).toBe(true);
  });
});

describe('formatPeriodInput', () => {
  it.each([
    [{ year: 2026, month: 9 }, '2026-09'],
    [{ year: 2026, month: 12 }, '2026-12'],
    [{ year: 5, month: 1 }, '0005-01'],
    [{ year: 9999, month: 12 }, '9999-12']
  ])('formats %o as %s', (period, expected) => {
    expect(formatPeriodInput(period)).toBe(expected);
  });

  it('round-trips through parsePeriod', () => {
    expect(parsePeriod(formatPeriodInput({ year: 1, month: 1 }))).toEqual({ year: 1, month: 1 });
    expect(parsePeriod(formatPeriodInput({ year: 2026, month: 11 }))).toEqual({ year: 2026, month: 11 });
  });
});

describe('currentPeriod and currentMonthSpendingPath', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [new Date(2026, 0, 1), { year: 2026, month: 1 }],
    [new Date(2026, 8, 30, 23, 59), { year: 2026, month: 9 }],
    [new Date(2026, 11, 31, 23, 59), { year: 2026, month: 12 }]
  ])('takes the local calendar month of %s', (date, expected) => {
    expect(currentPeriod(date)).toEqual(expected);
  });

  it('defaults to today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 12));

    expect(currentPeriod()).toEqual({ year: 2026, month: 11 });
    expect(currentMonthSpendingPath()).toBe('/monthly-plans/2026/11/spending');
  });

  it('builds the spending route of the given date without zero padding', () => {
    expect(currentMonthSpendingPath(new Date(2026, 8, 5))).toBe('/monthly-plans/2026/9/spending');
    expect(currentMonthSpendingPath(new Date(2027, 0, 1))).toBe('/monthly-plans/2027/1/spending');
  });
});

describe('shiftPeriod', () => {
  it.each([
    [{ year: 2026, month: 9 }, -1, { year: 2026, month: 8 }],
    [{ year: 2026, month: 9 }, 1, { year: 2026, month: 10 }],
    [{ year: 2026, month: 9 }, 0, { year: 2026, month: 9 }],
    [{ year: 2026, month: 1 }, -1, { year: 2025, month: 12 }],
    [{ year: 2026, month: 12 }, 1, { year: 2027, month: 1 }],
    [{ year: 2026, month: 9 }, -13, { year: 2025, month: 8 }],
    [{ year: 2026, month: 9 }, 24, { year: 2028, month: 9 }],
    [{ year: 1, month: 2 }, -1, { year: 1, month: 1 }],
    [{ year: 9999, month: 11 }, 1, { year: 9999, month: 12 }]
  ])('moves %o by %i months to %o', (period, months, expected) => {
    expect(shiftPeriod(period, months)).toEqual(expected);
  });

  it.each([
    [{ year: 1, month: 1 }, -1],
    [{ year: 9999, month: 12 }, 1],
    [{ year: 1, month: 6 }, -12],
    [{ year: 9999, month: 1 }, 12]
  ])('returns null when %o moved by %i months leaves years 1-9999', (period, months) => {
    expect(shiftPeriod(period, months)).toBeNull();
  });
});

describe('isSamePeriod', () => {
  it('is true for the same year and month in different objects', () => {
    expect(isSamePeriod({ year: 2026, month: 9 }, { year: 2026, month: 9 })).toBe(true);
  });

  it.each([
    ['another month', { year: 2026, month: 9 }, { year: 2026, month: 10 }],
    ['another year', { year: 2026, month: 9 }, { year: 2025, month: 9 }],
    ['a null first period', null, { year: 2026, month: 9 }],
    ['a null second period', { year: 2026, month: 9 }, null],
    ['two null periods', null, null]
  ])('is false for %s', (_label, a, b) => {
    expect(isSamePeriod(a, b)).toBe(false);
  });
});
