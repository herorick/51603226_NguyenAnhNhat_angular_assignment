import { Pipe, PipeTransform } from '@angular/core';

const MONEY_STRING = /^-?\d+$/;

/**
 * Display-only grouping of a whole-VND string: `"25000000"` -> `"25,000,000 VND"`.
 * Works on `BigInt`, so no floating point touches money. A value that is not a digit string is returned as-is
 * instead of being guessed at, and the output is never sent back to the API.
 */
export const formatVnd = (value: string): string =>
  MONEY_STRING.test(value) ? `${BigInt(value).toLocaleString('en-US')} VND` : value;

@Pipe({ name: 'vnd' })
export class VndPipe implements PipeTransform {
  transform(value: string): string {
    return formatVnd(value);
  }
}
