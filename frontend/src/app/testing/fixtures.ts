import { ApiErrorResponse } from '../models/api-error.models';
import {
  CreateExpenseResponse,
  DefaultJarsResponse,
  MonthlyPlanResponse,
  SpendingByJarsResponse
} from '../models/budget-plan.models';

/** Seven default jars in the backend's canonical order. */
export const DEFAULT_JARS_FIXTURE: DefaultJarsResponse = {
  currency: 'VND',
  totalPercentage: 100,
  jars: [
    {
      jarType: 'livingExpenses',
      name: 'Living Expenses',
      percentage: 35,
      suggestedLogic: 'Rent, utilities and daily needs.'
    },
    { jarType: 'food', name: 'Food', percentage: 20, suggestedLogic: 'Groceries and meals.' },
    { jarType: 'children', name: 'Children', percentage: 10, suggestedLogic: 'Education and care.' },
    { jarType: 'emergencyFund', name: 'Emergency Fund', percentage: 10, suggestedLogic: 'Unexpected costs.' },
    { jarType: 'savings', name: 'Savings', percentage: 10, suggestedLogic: 'Long-term savings.' },
    { jarType: 'investment', name: 'Investment', percentage: 10, suggestedLogic: 'Investments.' },
    { jarType: 'entertainmentAndTravel', name: 'Entertainment & Travel', percentage: 5, suggestedLogic: 'Leisure.' }
  ]
};

/** Same jars in a non-canonical order: proves the UI renders the response order and never sorts. */
export const NON_CANONICAL_DEFAULT_JARS_FIXTURE: DefaultJarsResponse = {
  ...DEFAULT_JARS_FIXTURE,
  jars: [...DEFAULT_JARS_FIXTURE.jars].reverse()
};

export const MONTHLY_PLAN_FIXTURE: MonthlyPlanResponse = {
  id: 1,
  year: 2026,
  month: 9,
  monthlyIncomeVnd: '25000000',
  currency: 'VND',
  createdAtUtc: '2026-09-01T00:00:00Z',
  jars: [
    { jarType: 'livingExpenses', name: 'Living Expenses', percentage: 35, budgetVnd: '8750000' },
    { jarType: 'food', name: 'Food', percentage: 20, budgetVnd: '5000000' },
    { jarType: 'children', name: 'Children', percentage: 10, budgetVnd: '2500000' },
    { jarType: 'emergencyFund', name: 'Emergency Fund', percentage: 10, budgetVnd: '2500000' },
    { jarType: 'savings', name: 'Savings', percentage: 10, budgetVnd: '2500000' },
    { jarType: 'investment', name: 'Investment', percentage: 10, budgetVnd: '2500000' },
    { jarType: 'entertainmentAndTravel', name: 'Entertainment & Travel', percentage: 5, budgetVnd: '1250000' }
  ]
};

/** Same plan with jars reversed: proves the UI renders the response order and never sorts. */
export const NON_CANONICAL_MONTHLY_PLAN_FIXTURE: MonthlyPlanResponse = {
  ...MONTHLY_PLAN_FIXTURE,
  jars: [...MONTHLY_PLAN_FIXTURE.jars].reverse()
};

/** Plan for the next month with different budgets: proves the page never reuses the previous month's jars. */
export const OCTOBER_PLAN_FIXTURE: MonthlyPlanResponse = {
  ...MONTHLY_PLAN_FIXTURE,
  id: 2,
  month: 10,
  monthlyIncomeVnd: '10000000',
  createdAtUtc: '2026-10-01T00:00:00Z',
  jars: MONTHLY_PLAN_FIXTURE.jars.map((jar, index) => ({ ...jar, budgetVnd: String(1000000 * (index + 1)) }))
};

export const CREATE_EXPENSE_RESPONSE_FIXTURE: CreateExpenseResponse = {
  expense: {
    id: 10,
    expenseDate: '2026-09-15',
    jarType: 'food',
    jarName: 'Food',
    amountVnd: '1250000',
    description: 'Weekly groceries',
    createdAtUtc: '2026-09-15T08:00:00Z'
  },
  jarSummary: {
    jarType: 'food',
    jarName: 'Food',
    percentage: 20,
    budgetVnd: '5000000',
    spentVnd: '1250000',
    remainingVnd: '3750000'
  }
};

/** Spent is above budget: `remainingVnd` is negative, which is a valid state. */
export const OVER_BUDGET_EXPENSE_RESPONSE_FIXTURE: CreateExpenseResponse = {
  ...CREATE_EXPENSE_RESPONSE_FIXTURE,
  jarSummary: { ...CREATE_EXPENSE_RESPONSE_FIXTURE.jarSummary, spentVnd: '5500000', remainingVnd: '-500000' }
};

export const EXPENSE_VALIDATION_ERROR_FIXTURE: ApiErrorResponse = {
  code: 'VALIDATION_ERROR',
  message: 'One or more fields are invalid.',
  errors: [
    { field: 'amountVnd', code: 'MUST_BE_POSITIVE', message: 'Amount must be greater than zero.' },
    { field: 'description', code: 'TOO_LONG', message: 'Description must be 500 characters or fewer.' }
  ]
};

export const JAR_NOT_IN_PLAN_ERROR_FIXTURE: ApiErrorResponse = {
  code: 'JAR_NOT_IN_MONTHLY_PLAN',
  message: 'The selected jar is not part of the monthly plan for 2026-09.',
  errors: []
};

export const DUPLICATE_PLAN_ERROR_FIXTURE: ApiErrorResponse = {
  code: 'MONTHLY_PLAN_ALREADY_EXISTS',
  message: 'A monthly plan already exists for 2026-09.',
  errors: []
};

export const VALIDATION_ERROR_FIXTURE: ApiErrorResponse = {
  code: 'VALIDATION_ERROR',
  message: 'One or more fields are invalid.',
  errors: [
    { field: 'monthlyIncomeVnd', code: 'MUST_BE_POSITIVE', message: 'Monthly income must be greater than zero.' },
    { field: 'month', code: 'OUT_OF_RANGE', message: 'Month must be between 1 and 12.' }
  ]
};

export const NOT_FOUND_ERROR_FIXTURE: ApiErrorResponse = {
  code: 'MONTHLY_PLAN_NOT_FOUND',
  message: 'No monthly plan exists for 2026-09.',
  errors: []
};

export const INTERNAL_ERROR_FIXTURE: ApiErrorResponse = {
  code: 'INTERNAL_ERROR',
  message: 'Unhandled exception: stack trace that must never reach the UI.',
  errors: []
};

/**
 * Seven jars in canonical order covering every row state: partial, zero spend, exactly 100%, over 100% with decimals
 * and a repeating-decimal percentage. `percentageUsed` values are backend output, so they are fixed here, not derived.
 */
export const SPENDING_BY_JARS_FIXTURE: SpendingByJarsResponse = {
  year: 2026,
  month: 9,
  currency: 'VND',
  jars: [
    {
      jarType: 'livingExpenses',
      jarName: 'Living Expenses',
      percentageUsed: 50,
      plannedBudgetVnd: '8750000',
      spentBudgetVnd: '4375000'
    },
    { jarType: 'food', jarName: 'Food', percentageUsed: 0, plannedBudgetVnd: '5000000', spentBudgetVnd: '0' },
    {
      jarType: 'children',
      jarName: 'Children',
      percentageUsed: 25,
      plannedBudgetVnd: '2500000',
      spentBudgetVnd: '625000'
    },
    {
      jarType: 'emergencyFund',
      jarName: 'Emergency Fund',
      percentageUsed: 0,
      plannedBudgetVnd: '2500000',
      spentBudgetVnd: '0'
    },
    {
      jarType: 'savings',
      jarName: 'Savings',
      percentageUsed: 100,
      plannedBudgetVnd: '2500000',
      spentBudgetVnd: '2500000'
    },
    {
      jarType: 'investment',
      jarName: 'Investment',
      percentageUsed: 125.5,
      plannedBudgetVnd: '2500000',
      spentBudgetVnd: '3137500'
    },
    {
      jarType: 'entertainmentAndTravel',
      jarName: 'Entertainment & Travel',
      percentageUsed: 33.33,
      plannedBudgetVnd: '1250000',
      spentBudgetVnd: '416667'
    }
  ]
};

/** Same jars reversed: proves the UI renders the response order and never sorts. */
export const NON_CANONICAL_SPENDING_BY_JARS_FIXTURE: SpendingByJarsResponse = {
  ...SPENDING_BY_JARS_FIXTURE,
  jars: [...SPENDING_BY_JARS_FIXTURE.jars].reverse()
};

/** Next month with nothing spent: proves the page never reuses the previous month's rows. */
export const OCTOBER_SPENDING_BY_JARS_FIXTURE: SpendingByJarsResponse = {
  ...SPENDING_BY_JARS_FIXTURE,
  month: 10,
  jars: SPENDING_BY_JARS_FIXTURE.jars.map((jar) => ({ ...jar, percentageUsed: 0, spentBudgetVnd: '0' }))
};
