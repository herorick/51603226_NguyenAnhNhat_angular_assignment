import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { isPositiveWholeVnd, isZeroWholeVnd, normalizeVndInput, positiveWholeVndValidator } from './vnd-amount';

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
