import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { BUDGET_PLAN_ENDPOINTS } from '../../constants/api-endpoints';
import {
  CreateExpenseRequest,
  CreateExpenseResponse,
  CreateMonthlyPlanRequest,
  DefaultJarsResponse,
  MonthComparisonResponse,
  MonthlyExpensesResponse,
  MonthlyPlanResponse,
  MonthlyPlanSummary,
  SpendingByJarsResponse
} from '../../models/budget-plan.models';
import { toAppError } from '../errors/app-error';

@Injectable({ providedIn: 'root' })
export class BudgetPlanApiService {
  private readonly http = inject(HttpClient);

  getDefaultJars(): Observable<DefaultJarsResponse> {
    return this.http
      .get<DefaultJarsResponse>(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS)
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** Not cached: every subscription issues a new GET, so a retry always reflects the server's current state. */
  getMonthlyPlan(year: number, month: number): Observable<MonthlyPlanResponse> {
    return this.http
      .get<MonthlyPlanResponse>(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(year, month))
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** POST is never retried automatically: a timed-out create may have succeeded on the server. */
  createMonthlyPlan(request: CreateMonthlyPlanRequest): Observable<MonthlyPlanResponse> {
    return this.http
      .post<MonthlyPlanResponse>(BUDGET_PLAN_ENDPOINTS.PLANS, request)
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /**
   * The backend derives the plan from `expenseDate`, so no year or month is sent.
   * POST is never retried automatically: a timed-out create may have succeeded on the server.
   */
  createExpense(request: CreateExpenseRequest): Observable<CreateExpenseResponse> {
    return this.http
      .post<CreateExpenseResponse>(BUDGET_PLAN_ENDPOINTS.EXPENSES, request)
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** Replaces an expense's date, jar, amount and description. Never retried automatically. */
  updateExpense(id: number, request: CreateExpenseRequest): Observable<CreateExpenseResponse> {
    return this.http
      .put<CreateExpenseResponse>(BUDGET_PLAN_ENDPOINTS.EXPENSE_BY_ID(id), request)
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** Deletes one expense (204). Never retried automatically. */
  deleteExpense(id: number): Observable<void> {
    return this.http
      .delete<void>(BUDGET_PLAN_ENDPOINTS.EXPENSE_BY_ID(id))
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** Not cached: spending must reflect expenses created since the last visit, so every subscription issues a GET. */
  getSpendingByJars(year: number, month: number): Observable<SpendingByJarsResponse> {
    return this.http
      .get<SpendingByJarsResponse>(BUDGET_PLAN_ENDPOINTS.SPENDING_BY_JARS(year, month))
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** Every monthly plan, newest month first, with its spent and remaining totals. */
  listMonthlyPlans(): Observable<MonthlyPlanSummary[]> {
    return this.http
      .get<MonthlyPlanSummary[]>(BUDGET_PLAN_ENDPOINTS.PLANS)
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** Deletes a month's plan with its jars and expenses (204). Never retried automatically. */
  deleteMonthlyPlan(year: number, month: number): Observable<void> {
    return this.http
      .delete<void>(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(year, month))
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** Spending by jar for `months` consecutive months ending at `endYear`/`endMonth`, oldest first. */
  getMonthComparison(endYear: number, endMonth: number, months: number): Observable<MonthComparisonResponse> {
    const params = new HttpParams().set('endYear', endYear).set('endMonth', endMonth).set('months', months);
    return this.http
      .get<MonthComparisonResponse>(BUDGET_PLAN_ENDPOINTS.COMPARISON, { params })
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }

  /** The expenses recorded in one month, newest first. */
  getMonthlyExpenses(year: number, month: number): Observable<MonthlyExpensesResponse> {
    return this.http
      .get<MonthlyExpensesResponse>(BUDGET_PLAN_ENDPOINTS.EXPENSES_BY_PERIOD(year, month))
      .pipe(catchError((error: unknown) => throwError(() => toAppError(error))));
  }
}
