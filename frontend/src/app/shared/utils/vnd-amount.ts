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

export const positiveWholeVndValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  if (typeof value !== 'string') {
    return { positiveVnd: true };
  }
  return isPositiveWholeVnd(normalizeVndInput(value)) ? null : { positiveVnd: true };
};
