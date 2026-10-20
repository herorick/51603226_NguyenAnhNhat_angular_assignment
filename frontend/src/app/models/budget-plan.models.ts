export type JarType =
  'livingExpenses' | 'food' | 'children' | 'emergencyFund' | 'savings' | 'investment' | 'entertainmentAndTravel';

export interface DefaultJar {
  jarType: JarType;
  name: string;
  percentage: number;
  suggestedLogic: string;
}

export interface DefaultJarsResponse {
  currency: 'VND';
  totalPercentage: number;
  jars: DefaultJar[];
}

export interface CreateMonthlyPlanRequest {
  year: number;
  month: number;
  monthlyIncomeVnd: string;
}

export interface MonthlyPlanJar {
  jarType: JarType;
  name: string;
  percentage: number;
  budgetVnd: string;
}

export interface MonthlyPlanResponse {
  id: number;
  year: number;
  month: number;
  monthlyIncomeVnd: string;
  currency: 'VND';
  createdAtUtc: string;
  jars: MonthlyPlanJar[];
}

export interface CreateExpenseRequest {
  expenseDate: string;
  jarType: JarType;
  amountVnd: string;
  description: string;
}

export interface CreatedExpense {
  id: number;
  expenseDate: string;
  jarType: JarType;
  jarName: string;
  amountVnd: string;
  description: string;
  createdAtUtc: string;
}

export interface JarSpendingSummary {
  jarType: JarType;
  jarName: string;
  percentage: number;
  budgetVnd: string;
  spentVnd: string;
  /** Budget minus spent, computed by the backend. May start with `-` when the jar is over budget. */
  remainingVnd: string;
}

export interface CreateExpenseResponse {
  expense: CreatedExpense;
  jarSummary: JarSpendingSummary;
}

export interface SpendingByJar {
  jarType: JarType;
  jarName: string;
  /** Computed by the backend, 2 decimals at most. Can exceed 100 when the jar is over budget. */
  percentageUsed: number;
  plannedBudgetVnd: string;
  spentBudgetVnd: string;
}

export interface SpendingByJarsResponse {
  year: number;
  month: number;
  currency: 'VND';
  jars: SpendingByJar[];
}
