import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const DIGITS_ONLY = /^\d+$/;
const HAS_NON_ZERO_DIGIT = /[1-9]/;

const THOUSANDS_GROUPING = /^\d{1,3}(,\d{3})+$/;

/**
 * Removes display grouping and outer whitespace. Commas are removed only when they form valid thousands grouping
 * (`30,000,000`); anything else (`1,5`, `1,0,0`) is kept as typed so validation rejects it instead of changing the amount.
 */
export const normalizeVndInput = (raw: string): string => {
  const trimmed = raw.trim();
  return THOUSANDS_GROUPING.test(trimmed) ? trimmed.replace(/,/g, '') : trimmed;
};

const MAX_INT64 = 9223372036854775807n;

/**
 * Request rule for money: ASCII digits only, greater than zero and within the API's int64 range.
 * Works on the string; `BigInt` is an exact integer compare, so no floating point touches money.
 */
export const isPositiveWholeVnd = (digits: string): boolean =>
  DIGITS_ONLY.test(digits) && HAS_NON_ZERO_DIGIT.test(digits) && BigInt(digits) <= MAX_INT64;

/** True for a digit string with no non-zero digit (`0`, `000`): lets a form say "greater than zero" instead of "invalid". */
export const isZeroWholeVnd = (digits: string): boolean => DIGITS_ONLY.test(digits) && !HAS_NON_ZERO_DIGIT.test(digits);

/**
 * Live input formatting for money fields: keeps only ASCII digits, drops leading zeros (a lone `0` stays so the form
 * can still say "greater than zero") and groups thousands with commas: `1250000` -> `1,250,000`.
 * The result always passes `normalizeVndInput`, so the API still receives plain digits.
 */
export const formatVndInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/** Index in `formatted` that sits right after its `digitCount`-th digit: keeps the caret in place while regrouping. */
export const caretAfterDigits = (formatted: string, digitCount: number): number => {
  if (digitCount <= 0) {
    return 0;
  }
  let seen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/\d/.test(formatted[index]) && ++seen === digitCount) {
      return index + 1;
    }
  }
  return formatted.length;
};

const COMPACT_VND = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

/**
 * Short reading aid shown under a money input: `1,250,000` -> `≈ 1.25M VND`. Display only (never sent to the API),
 * so the float conversion is acceptable here. Empty for invalid input or amounts below one thousand.
 */
export const describeVndInput = (raw: string): string => {
  const digits = normalizeVndInput(raw);
  if (!isPositiveWholeVnd(digits) || digits.length < 4) {
    return '';
  }
  return `≈ ${COMPACT_VND.format(Number(digits))} VND`;
};

export const positiveWholeVndValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  if (typeof value !== 'string') {
    return { positiveVnd: true };
  }
  return isPositiveWholeVnd(normalizeVndInput(value)) ? null : { positiveVnd: true };
};
