import { describe, expect, it } from 'vitest';

import { BUDGET_PLAN_ENDPOINTS } from './api-endpoints';

describe('BUDGET_PLAN_ENDPOINTS', () => {
  it('builds budget plan API paths', () => {
    expect(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).toContain('/api/v1/budget-plans/default-jars');
    expect(BUDGET_PLAN_ENDPOINTS.PLANS).toContain('/api/v1/budget-plans');
    expect(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 3)).toContain('/api/v1/budget-plans/2026/3');
    expect(BUDGET_PLAN_ENDPOINTS.EXPENSES).toMatch(/\/api\/v1\/budget-plans\/expenses$/);
    expect(BUDGET_PLAN_ENDPOINTS.SPENDING_BY_JARS(2026, 3)).toMatch(
      /\/api\/v1\/budget-plans\/2026\/3\/spending-by-jars$/
    );
  });

  it('builds the monthly expenses path from the given year and month', () => {
    expect(BUDGET_PLAN_ENDPOINTS.EXPENSES_BY_PERIOD(2026, 9)).toMatch(/\/api\/v1\/budget-plans\/2026\/9\/expenses$/);
    expect(BUDGET_PLAN_ENDPOINTS.EXPENSES_BY_PERIOD(2025, 12)).toMatch(/\/api\/v1\/budget-plans\/2025\/12\/expenses$/);
    expect(BUDGET_PLAN_ENDPOINTS.EXPENSES_BY_PERIOD(2026, 9)).not.toBe(BUDGET_PLAN_ENDPOINTS.EXPENSES);
  });

  it('builds the single-expense path used by update and delete', () => {
    expect(BUDGET_PLAN_ENDPOINTS.EXPENSE_BY_ID(42)).toMatch(/\/api\/v1\/budget-plans\/expenses\/42$/);
  });

  it('lists plans on the same path the create POST uses', () => {
    expect(BUDGET_PLAN_ENDPOINTS.PLANS).toMatch(/\/api\/v1\/budget-plans$/);
  });
});
