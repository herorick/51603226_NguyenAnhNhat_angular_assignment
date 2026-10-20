import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { Period } from '../../monthly-planning/utils/period';

export const MAX_DESCRIPTION_LENGTH = 500;

const EXPENSE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1;

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

/**
 * Parses an `<input type="date">` value (`YYYY-MM-DD`) into the plan period it belongs to.
 * Returns null for anything that is not a real calendar date (`2026-02-30`, `2026-13-01`, `''`) or is outside the
 * API's year range. Built from a day-count table, not `Date`, because `new Date(5, 0, 1)` silently becomes year 1905.
 */
export const parseExpenseDate = (value: string): Period | null => {
  const match = EXPENSE_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month };
};

/** Local calendar date as `YYYY-MM-DD` (not `toISOString`, which shifts the day for UTC+7 users). */
export const formatExpenseDate = (date: Date): string =>
  [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');

export const expenseDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  return typeof value === 'string' && parseExpenseDate(value) ? null : { expenseDate: true };
};

/** The API trims the description before checking it, so the form validates the trimmed text too. */
export const descriptionValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length === 0) {
    return { required: true };
  }
  return trimmed.length > MAX_DESCRIPTION_LENGTH ? { maxlength: true } : null;
};
