import { environment } from '../../environments/environment';

const apiUrl = (path: string): string => `${environment.apiBaseUrl}${path}`;

export const BUDGET_PLAN_ENDPOINTS = {
  DEFAULT_JARS: apiUrl('/api/v1/budget-plans/default-jars'),
  PLANS: apiUrl('/api/v1/budget-plans'),
  EXPENSES: apiUrl('/api/v1/budget-plans/expenses'),
  EXPENSE_BY_ID: (id: number): string => apiUrl(`/api/v1/budget-plans/expenses/${id}`),
  BY_PERIOD: (year: number, month: number): string => apiUrl(`/api/v1/budget-plans/${year}/${month}`),
  SPENDING_BY_JARS: (year: number, month: number): string =>
    apiUrl(`/api/v1/budget-plans/${year}/${month}/spending-by-jars`),
  EXPENSES_BY_PERIOD: (year: number, month: number): string =>
    apiUrl(`/api/v1/budget-plans/${year}/${month}/expenses`),
  COMPARISON: apiUrl('/api/v1/budget-plans/comparison')
} as const;
