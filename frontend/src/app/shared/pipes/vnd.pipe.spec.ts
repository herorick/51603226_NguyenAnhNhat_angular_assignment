import { describe, expect, it } from 'vitest';

import { VndPipe, formatVnd } from './vnd.pipe';

describe('formatVnd', () => {
  it.each([
    ['0', '0 VND'],
    ['1', '1 VND'],
    ['999', '999 VND'],
    ['1000', '1,000 VND'],
    ['25000000', '25,000,000 VND'],
    ['-250000', '-250,000 VND'],
    ['9223372036854775807', '9,223,372,036,854,775,807 VND']
  ])('formats %s as %s', (value, expected) => {
    expect(formatVnd(value)).toBe(expected);
  });

  it('keeps precision above Number.MAX_SAFE_INTEGER (no floating point)', () => {
    expect(formatVnd('9007199254740993')).toBe('9,007,199,254,740,993 VND');
  });

  it.each(['', 'abc', '1.5', '1,000', ' 100', '1e3', '--5'])('returns %j unchanged instead of guessing', (value) => {
    expect(formatVnd(value)).toBe(value);
  });
});

describe('VndPipe', () => {
  it('delegates to formatVnd', () => {
    expect(new VndPipe().transform('8750000')).toBe('8,750,000 VND');
  });
});
