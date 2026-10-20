import { describe, expect, it } from 'vitest';

import { SpendingByJar, SpendingByJarsResponse } from '../../../models/budget-plan.models';
import {
  NON_CANONICAL_SPENDING_BY_JARS_FIXTURE,
  OCTOBER_SPENDING_BY_JARS_FIXTURE,
  SPENDING_BY_JARS_FIXTURE
} from '../../../testing/fixtures';
import { isValidSpendingByJars } from './spending-shape';

const JARS = SPENDING_BY_JARS_FIXTURE.jars;
const withJars = (jars: unknown[]): unknown => ({ ...SPENDING_BY_JARS_FIXTURE, jars });
const withJar = (index: number, patch: Partial<Record<keyof SpendingByJar, unknown>>): unknown =>
  withJars(JARS.map((jar, i) => (i === index ? { ...jar, ...patch } : jar)));

describe('isValidSpendingByJars', () => {
  it('accepts a well-formed seven-jar response', () => {
    expect(isValidSpendingByJars(SPENDING_BY_JARS_FIXTURE)).toBe(true);
  });

  it('accepts the same jars in a non-canonical order (shape only, never sorts)', () => {
    expect(isValidSpendingByJars(NON_CANONICAL_SPENDING_BY_JARS_FIXTURE)).toBe(true);
  });

  it('accepts a month with nothing spent', () => {
    expect(isValidSpendingByJars(OCTOBER_SPENDING_BY_JARS_FIXTURE)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['exactly 100', withJar(0, { percentageUsed: 100 })],
    ['above 100 with decimals', withJar(0, { percentageUsed: 125.5 })],
    ['far above 100', withJar(0, { percentageUsed: 1000000 })],
    ['exactly 0', withJar(0, { percentageUsed: 0 })]
  ])('accepts percentageUsed %s (over-budget is a valid state)', (_label, value) => {
    expect(isValidSpendingByJars(value)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['zero amounts', withJar(0, { spentBudgetVnd: '0', plannedBudgetVnd: '0' })],
    ['spent above planned', withJar(0, { spentBudgetVnd: '9999999999', plannedBudgetVnd: '1' })],
    ['amounts above 2^53', withJar(0, { spentBudgetVnd: '9007199254740993', plannedBudgetVnd: '9007199254740993123' })]
  ])('accepts %s as digit-only money strings', (_label, value) => {
    expect(isValidSpendingByJars(value)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'spending'],
    ['a number', 7],
    ['an array', []],
    ['an empty object', {}],
    ['a missing year', { ...SPENDING_BY_JARS_FIXTURE, year: undefined }],
    ['a string year', { ...SPENDING_BY_JARS_FIXTURE, year: '2026' }],
    ['a missing month', { ...SPENDING_BY_JARS_FIXTURE, month: undefined }],
    ['a string month', { ...SPENDING_BY_JARS_FIXTURE, month: '9' }],
    ['a missing currency', { ...SPENDING_BY_JARS_FIXTURE, currency: undefined }],
    ['a USD currency', { ...SPENDING_BY_JARS_FIXTURE, currency: 'USD' }],
    ['a lowercase currency', { ...SPENDING_BY_JARS_FIXTURE, currency: 'vnd' }],
    ['a missing jars array', { ...SPENDING_BY_JARS_FIXTURE, jars: undefined }],
    ['a jars value that is not an array', { ...SPENDING_BY_JARS_FIXTURE, jars: { length: 7 } }],
    ['no jars', withJars([])],
    ['six jars', withJars(JARS.slice(0, 6))],
    ['eight jars', withJars([...JARS, JARS[0]])],
    ['a null jar', withJars([null, ...JARS.slice(1)])],
    ['a string jar', withJars(['food', ...JARS.slice(1)])]
  ])('rejects %s', (_label, value) => {
    expect(isValidSpendingByJars(value)).toBe(false);
  });

  it.each<[string, unknown]>([
    ['an unknown jar type', withJar(0, { jarType: 'luxury' })],
    ['a prototype key as jar type', withJar(0, { jarType: 'toString' })],
    ['a non-string jar type', withJar(0, { jarType: 7 })],
    ['a missing jar type', withJar(0, { jarType: undefined })],
    ['a duplicated jar type (seven jars, six distinct)', withJar(1, { jarType: 'livingExpenses' })],
    ['a non-string jar name', withJar(0, { jarName: 7 })],
    ['a missing jar name', withJar(0, { jarName: undefined })]
  ])('rejects %s', (_label, value) => {
    expect(isValidSpendingByJars(value)).toBe(false);
  });

  it.each<[string, unknown]>([
    ['a missing percentageUsed', withJar(0, { percentageUsed: undefined })],
    ['a null percentageUsed', withJar(0, { percentageUsed: null })],
    ['a string percentageUsed', withJar(0, { percentageUsed: '50' })],
    ['a NaN percentageUsed', withJar(0, { percentageUsed: Number.NaN })],
    ['an infinite percentageUsed', withJar(0, { percentageUsed: Number.POSITIVE_INFINITY })],
    ['a negative infinite percentageUsed', withJar(0, { percentageUsed: Number.NEGATIVE_INFINITY })],
    ['a negative percentageUsed', withJar(0, { percentageUsed: -0.01 })]
  ])('rejects %s', (_label, value) => {
    expect(isValidSpendingByJars(value)).toBe(false);
  });

  describe.each(['plannedBudgetVnd', 'spentBudgetVnd'] as const)('%s', (field) => {
    it.each<[string, unknown]>([
      ['a missing value', undefined],
      ['a null value', null],
      ['a number, not a string', 4375000],
      ['an empty string', ''],
      ['a negative amount', '-1'],
      ['a decimal amount', '1.5'],
      ['a grouped amount', '1,000'],
      ['a formatted amount with the unit', '1000 VND'],
      ['an amount with letters', '4.3M'],
      ['an amount with surrounding spaces', ' 100 '],
      ['an amount with a trailing newline', '100\n'],
      ['an amount in full-width digits', '１２３']
    ])('rejects %s', (_label, value) => {
      expect(isValidSpendingByJars(withJar(0, { [field]: value }))).toBe(false);
    });
  });

  it('rejects the body when only the last jar is bad', () => {
    expect(isValidSpendingByJars(withJar(6, { spentBudgetVnd: 'x' }))).toBe(false);
  });

  it('narrows to SpendingByJarsResponse', () => {
    const value: unknown = SPENDING_BY_JARS_FIXTURE;
    if (isValidSpendingByJars(value)) {
      const spending: SpendingByJarsResponse = value;
      expect(spending.jars).toHaveLength(7);
    } else {
      expect.unreachable('the fixture must pass the guard');
    }
  });
});
