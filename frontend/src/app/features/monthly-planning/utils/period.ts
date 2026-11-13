import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface Period {
  year: number;
  month: number;
}

const PERIOD_PATTERN = /^(\d{4,6})-(\d{2})$/;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

/** Parses an `<input type="month">` value (`YYYY-MM`). Returns null when missing or out of the API range. */
export const parsePeriod = (value: string): Period | null => {
  const match = PERIOD_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
};

const ROUTE_INTEGER = /^\d+$/;

/**
 * Validates `:year/:month` route segments before any HTTP call (the API gives a bare 404 for non-numeric segments).
 * Accepts ASCII digits only and the same range as the API: year 1-9999, month 1-12.
 */
export const parseRoutePeriod = (year: string | null, month: string | null): Period | null => {
  if (year === null || month === null || !ROUTE_INTEGER.test(year) || !ROUTE_INTEGER.test(month)) {
    return null;
  }
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (parsedYear < MIN_YEAR || parsedYear > MAX_YEAR || parsedMonth < 1 || parsedMonth > 12) {
    return null;
  }
  return { year: parsedYear, month: parsedMonth };
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

/** `September 2026`. Built from a name table, not `Date`, because `new Date(5, 8)` silently becomes year 1905. */
export const formatPeriodLabel = (period: Period): string => `${MONTH_NAMES[period.month - 1]} ${period.year}`;

/** `YYYY-MM-01`: the expense date the "Add expense" link pre-fills for a plan's month. */
export const firstDayOfPeriod = (period: Period): string =>
  `${String(period.year).padStart(4, '0')}-${String(period.month).padStart(2, '0')}-01`;

/** `YYYY-MM`: the `<input type="month">` value for a period, also used as the `?period=` query param. */
export const formatPeriodInput = (period: Period): string =>
  `${String(period.year).padStart(4, '0')}-${String(period.month).padStart(2, '0')}`;

/** The local calendar month of `date` (today by default). */
export const currentPeriod = (date: Date = new Date()): Period => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1
});

/** Moves a period by whole months (`-1` = previous month). Null when the result leaves the API's year range. */
export const shiftPeriod = (period: Period, months: number): Period | null => {
  const index = period.year * 12 + (period.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return year < MIN_YEAR || year > MAX_YEAR ? null : { year, month };
};

export const isSamePeriod = (a: Period | null, b: Period | null): boolean =>
  a !== null && b !== null && a.year === b.year && a.month === b.month;

/** Route of the current month's spending page: what "Home" opens, since there is no separate dashboard. */
export const currentMonthSpendingPath = (date: Date = new Date()): string => {
  const { year, month } = currentPeriod(date);
  return `/monthly-plans/${year}/${month}/spending`;
};

export const periodValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  return typeof value === 'string' && parsePeriod(value) ? null : { period: true };
};
