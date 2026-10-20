import { environment } from '../../environments/environment';

const apiUrl = (path: string): string => `${environment.apiBaseUrl}${path}`;

export const BUDGET_PLAN_ENDPOINTS = {
  DEFAULT_JARS: apiUrl('/api/v1/budget-plans/default-jars'),
  PLANS: apiUrl('/api/v1/budget-plans'),
  BY_PERIOD: (year: number, month: number): string => apiUrl(`/api/v1/budget-plans/${year}/${month}`),
  SPENDING_BY_JARS: (year: number, month: number): string => apiUrl(`/api/v1/budget-plans/${year}/${month}/spending-by-jars`)
} as const;
