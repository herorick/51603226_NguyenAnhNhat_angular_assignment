import { describe, expect, it } from 'vitest';

import { MonthlyPlanJar, MonthlyPlanResponse } from '../../../models/budget-plan.models';
import { MONTHLY_PLAN_FIXTURE, NON_CANONICAL_MONTHLY_PLAN_FIXTURE } from '../../../testing/fixtures';
import { isValidMonthlyPlan } from './plan-shape';

const withJars = (jars: unknown[]): unknown => ({ ...MONTHLY_PLAN_FIXTURE, jars });
const withJar = (index: number, patch: Partial<Record<keyof MonthlyPlanJar, unknown>>): unknown =>
  withJars(MONTHLY_PLAN_FIXTURE.jars.map((jar, i) => (i === index ? { ...jar, ...patch } : jar)));

describe('isValidMonthlyPlan', () => {
  it('accepts a well-formed seven-jar plan', () => {
    expect(isValidMonthlyPlan(MONTHLY_PLAN_FIXTURE)).toBe(true);
  });

  it('accepts the same jars in a non-canonical order (shape only, never sorts)', () => {
    expect(isValidMonthlyPlan(NON_CANONICAL_MONTHLY_PLAN_FIXTURE)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['a string', 'plan'],
    ['an array', []],
    ['a wrong currency', { ...MONTHLY_PLAN_FIXTURE, currency: 'USD' }],
    ['a numeric income', { ...MONTHLY_PLAN_FIXTURE, monthlyIncomeVnd: 25000000 }],
    ['a grouped income', { ...MONTHLY_PLAN_FIXTURE, monthlyIncomeVnd: '25,000,000' }],
    ['a negative income', { ...MONTHLY_PLAN_FIXTURE, monthlyIncomeVnd: '-1' }],
    ['a missing jars array', { ...MONTHLY_PLAN_FIXTURE, jars: undefined }],
    ['six jars', withJars(MONTHLY_PLAN_FIXTURE.jars.slice(0, 6))],
    ['eight jars', withJars([...MONTHLY_PLAN_FIXTURE.jars, MONTHLY_PLAN_FIXTURE.jars[0]])],
    ['a duplicated jar type', withJar(1, { jarType: 'livingExpenses' })],
    ['an unknown jar type', withJar(0, { jarType: 'toString' })],
    ['a non-string jar name', withJar(0, { name: 7 })],
    ['a non-numeric percentage', withJar(0, { percentage: '35' })],
    ['a non-finite percentage', withJar(0, { percentage: Number.NaN })],
    ['an infinite percentage', withJar(0, { percentage: Number.POSITIVE_INFINITY })],
    ['a negative percentage', withJar(0, { percentage: -5 })],
    ['a percentage above 100', withJar(0, { percentage: 100.01 })],
    ['a missing year', { ...MONTHLY_PLAN_FIXTURE, year: undefined }],
    ['a string month', { ...MONTHLY_PLAN_FIXTURE, month: '9' }],
    ['a decimal budget', withJar(0, { budgetVnd: '8750000.5' })],
    ['a numeric budget', withJar(0, { budgetVnd: 8750000 })],
    ['a null jar', withJars([null, ...MONTHLY_PLAN_FIXTURE.jars.slice(1)])]
  ])('rejects %s', (_label, value) => {
    expect(isValidMonthlyPlan(value)).toBe(false);
  });

  it('narrows to MonthlyPlanResponse', () => {
    const value: unknown = MONTHLY_PLAN_FIXTURE;
    if (isValidMonthlyPlan(value)) {
      const plan: MonthlyPlanResponse = value;
      expect(plan.jars).toHaveLength(7);
    }
  });
});
