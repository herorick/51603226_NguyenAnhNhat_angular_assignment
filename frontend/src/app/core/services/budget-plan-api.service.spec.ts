import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUDGET_PLAN_ENDPOINTS } from '../../constants/api-endpoints';
import { AppError } from '../../models/api-error.models';
import {
  CreateExpenseRequest,
  CreateExpenseResponse,
  CreateMonthlyPlanRequest,
  DefaultJarsResponse,
  MonthlyPlanResponse,
  SpendingByJarsResponse
} from '../../models/budget-plan.models';
import {
  CREATE_EXPENSE_RESPONSE_FIXTURE,
  DEFAULT_JARS_FIXTURE,
  DUPLICATE_PLAN_ERROR_FIXTURE,
  EXPENSE_VALIDATION_ERROR_FIXTURE,
  INTERNAL_ERROR_FIXTURE,
  JAR_NOT_IN_PLAN_ERROR_FIXTURE,
  MONTHLY_PLAN_FIXTURE,
  NON_CANONICAL_DEFAULT_JARS_FIXTURE,
  NON_CANONICAL_MONTHLY_PLAN_FIXTURE,
  NON_CANONICAL_SPENDING_BY_JARS_FIXTURE,
  NOT_FOUND_ERROR_FIXTURE,
  OCTOBER_SPENDING_BY_JARS_FIXTURE,
  SPENDING_BY_JARS_FIXTURE,
  VALIDATION_ERROR_FIXTURE
} from '../../testing/fixtures';
import { BudgetPlanApiService } from './budget-plan-api.service';

const REQUEST: CreateMonthlyPlanRequest = { year: 2026, month: 9, monthlyIncomeVnd: '25000000' };
const EXPENSE_REQUEST: CreateExpenseRequest = {
  expenseDate: '2026-09-15',
  jarType: 'food',
  amountVnd: '1250000',
  description: 'Weekly groceries'
};
const GENERIC_SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';

describe('BudgetPlanApiService', () => {
  let service: BudgetPlanApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BudgetPlanApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getDefaultJars', () => {
    it('is cold: no request until subscribed', () => {
      service.getDefaultJars();

      http.expectNone(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS);
    });

    it('issues one GET to the default-jars endpoint and passes the 200 body through', () => {
      const next = vi.fn<(value: DefaultJarsResponse) => void>();
      const error = vi.fn();

      service.getDefaultJars().subscribe({ next, error });

      const call = http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS);
      expect(call.request.method).toBe('GET');
      expect(call.request.body).toBeNull();
      call.flush(DEFAULT_JARS_FIXTURE);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(DEFAULT_JARS_FIXTURE);
      expect(error).not.toHaveBeenCalled();
    });

    it('keeps the jar order returned by the API (no client sorting)', () => {
      let received: DefaultJarsResponse | undefined;

      service.getDefaultJars().subscribe((value) => (received = value));
      http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).flush(NON_CANONICAL_DEFAULT_JARS_FIXTURE);

      expect(received?.jars.map((jar) => jar.jarType)).toEqual(
        NON_CANONICAL_DEFAULT_JARS_FIXTURE.jars.map((j) => j.jarType)
      );
      expect(received?.jars[0].jarType).toBe('entertainmentAndTravel');
    });

    it('maps a 500 to a server AppError with the generic message and without the raw body message', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getDefaultJars().subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS)
        .flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });

      expect(error).toHaveBeenCalledTimes(1);
      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('server');
      expect(appError.status).toBe(500);
      expect(appError.message).toBe(GENERIC_SERVER_MESSAGE);
      expect(appError.message).not.toContain(INTERNAL_ERROR_FIXTURE.message);
    });

    it('maps a network failure to a network AppError and does not retry', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getDefaultJars().subscribe({ error });
      http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).error(new ProgressEvent('error'));

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0].kind).toBe('network');
      expect(error.mock.calls[0][0].code).toBe('NETWORK_ERROR');
      http.expectNone(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS);
    });

    it('issues a new request on every subscription (no caching)', () => {
      service.getDefaultJars().subscribe();
      http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).flush(DEFAULT_JARS_FIXTURE);

      service.getDefaultJars().subscribe();
      http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).flush(DEFAULT_JARS_FIXTURE);
    });
  });

  describe('getMonthlyPlan', () => {
    it('is cold: no request until subscribed', () => {
      service.getMonthlyPlan(2026, 9);

      http.expectNone(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9));
    });

    it('issues one GET to the period endpoint and passes the 200 body through', () => {
      const next = vi.fn<(value: MonthlyPlanResponse) => void>();
      const error = vi.fn();

      service.getMonthlyPlan(2026, 9).subscribe({ next, error });

      const call = http.expectOne(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9));
      expect(call.request.method).toBe('GET');
      expect(call.request.urlWithParams).toMatch(/\/api\/v1\/budget-plans\/2026\/9$/);
      expect(call.request.body).toBeNull();
      call.flush(MONTHLY_PLAN_FIXTURE);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(MONTHLY_PLAN_FIXTURE);
      expect(error).not.toHaveBeenCalled();
    });

    it('keeps money as strings and the jar order returned by the API', () => {
      let received: MonthlyPlanResponse | undefined;

      service.getMonthlyPlan(2026, 9).subscribe((value) => (received = value));
      http.expectOne(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9)).flush(NON_CANONICAL_MONTHLY_PLAN_FIXTURE);

      expect(received?.jars.map((jar) => jar.jarType)).toEqual(
        NON_CANONICAL_MONTHLY_PLAN_FIXTURE.jars.map((jar) => jar.jarType)
      );
      expect(received?.jars[0].jarType).toBe('entertainmentAndTravel');
      expect(typeof received?.monthlyIncomeVnd).toBe('string');
      expect(typeof received?.jars[0].budgetVnd).toBe('string');
    });

    it('maps a 404 to a not-found AppError carrying the MONTHLY_PLAN_NOT_FOUND code', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getMonthlyPlan(2026, 9).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9))
        .flush(NOT_FOUND_ERROR_FIXTURE, { status: 404, statusText: 'Not Found' });

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toEqual({
        kind: 'not-found',
        status: 404,
        code: 'MONTHLY_PLAN_NOT_FOUND',
        message: NOT_FOUND_ERROR_FIXTURE.message,
        fieldErrors: []
      });
    });

    it('maps a 400 to a validation AppError', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getMonthlyPlan(2026, 9).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9))
        .flush(VALIDATION_ERROR_FIXTURE, { status: 400, statusText: 'Bad Request' });

      expect(error.mock.calls[0][0].kind).toBe('validation');
    });

    it('maps a 500 to a server AppError without the raw body message', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getMonthlyPlan(2026, 9).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9))
        .flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });

      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('server');
      expect(appError.message).toBe(GENERIC_SERVER_MESSAGE);
      expect(appError.message).not.toContain(INTERNAL_ERROR_FIXTURE.message);
    });

    it('maps a network failure to a network AppError and does not retry', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getMonthlyPlan(2026, 9).subscribe({ error });
      http.expectOne(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9)).error(new ProgressEvent('error'));

      expect(error.mock.calls[0][0].kind).toBe('network');
      http.expectNone(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9));
    });

    it('issues a new request on every subscription (no caching)', () => {
      const plan$ = service.getMonthlyPlan(2026, 9);

      plan$.subscribe();
      http.expectOne(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9)).flush(MONTHLY_PLAN_FIXTURE);

      plan$.subscribe();
      http.expectOne(BUDGET_PLAN_ENDPOINTS.BY_PERIOD(2026, 9)).flush(MONTHLY_PLAN_FIXTURE);
    });
  });

  describe('createMonthlyPlan', () => {
    it('is cold: no request until subscribed', () => {
      service.createMonthlyPlan(REQUEST);

      http.expectNone(BUDGET_PLAN_ENDPOINTS.PLANS);
    });

    it('POSTs the exact body to the plans endpoint and passes the 201 body through', () => {
      const next = vi.fn<(value: MonthlyPlanResponse) => void>();
      const error = vi.fn();

      service.createMonthlyPlan(REQUEST).subscribe({ next, error });

      const call = http.expectOne(BUDGET_PLAN_ENDPOINTS.PLANS);
      expect(call.request.method).toBe('POST');
      expect(call.request.body).toEqual({ year: 2026, month: 9, monthlyIncomeVnd: '25000000' });
      expect(typeof call.request.body.monthlyIncomeVnd).toBe('string');
      call.flush(MONTHLY_PLAN_FIXTURE, { status: 201, statusText: 'Created' });

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(MONTHLY_PLAN_FIXTURE);
      expect(error).not.toHaveBeenCalled();
    });

    it('keeps the jar order of the created plan', () => {
      let received: MonthlyPlanResponse | undefined;
      const reversed: MonthlyPlanResponse = { ...MONTHLY_PLAN_FIXTURE, jars: [...MONTHLY_PLAN_FIXTURE.jars].reverse() };

      service.createMonthlyPlan(REQUEST).subscribe((value) => (received = value));
      http.expectOne(BUDGET_PLAN_ENDPOINTS.PLANS).flush(reversed, { status: 201, statusText: 'Created' });

      expect(received?.jars.map((jar) => jar.jarType)).toEqual(reversed.jars.map((jar) => jar.jarType));
    });

    it('maps a 409 to a conflict AppError with the envelope code and message', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createMonthlyPlan(REQUEST).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.PLANS)
        .flush(DUPLICATE_PLAN_ERROR_FIXTURE, { status: 409, statusText: 'Conflict' });

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toEqual({
        kind: 'conflict',
        status: 409,
        code: 'MONTHLY_PLAN_ALREADY_EXISTS',
        message: DUPLICATE_PLAN_ERROR_FIXTURE.message,
        fieldErrors: []
      });
    });

    it('maps a 400 to a validation AppError carrying the field errors', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createMonthlyPlan(REQUEST).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.PLANS)
        .flush(VALIDATION_ERROR_FIXTURE, { status: 400, statusText: 'Bad Request' });

      expect(error).toHaveBeenCalledTimes(1);
      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('validation');
      expect(appError.status).toBe(400);
      expect(appError.code).toBe('VALIDATION_ERROR');
      expect(appError.fieldErrors).toEqual(VALIDATION_ERROR_FIXTURE.errors);
    });

    it('maps a 500 to a server AppError without the raw body message', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createMonthlyPlan(REQUEST).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.PLANS)
        .flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });

      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('server');
      expect(appError.message).toBe(GENERIC_SERVER_MESSAGE);
      expect(appError.message).not.toContain(INTERNAL_ERROR_FIXTURE.message);
    });

    it('maps a network failure to a network AppError', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createMonthlyPlan(REQUEST).subscribe({ error });
      http.expectOne(BUDGET_PLAN_ENDPOINTS.PLANS).error(new ProgressEvent('error'));

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0].kind).toBe('network');
      expect(error.mock.calls[0][0].status).toBe(0);
    });

    it.each([
      ['a 500', () => ({ body: INTERNAL_ERROR_FIXTURE, init: { status: 500, statusText: 'Internal Server Error' } })],
      ['a 409', () => ({ body: DUPLICATE_PLAN_ERROR_FIXTURE, init: { status: 409, statusText: 'Conflict' } })]
    ])('sends exactly one request after %s: no automatic retry', (_label, response) => {
      service.createMonthlyPlan(REQUEST).subscribe({ error: () => undefined });

      const { body, init } = response();
      http.expectOne(BUDGET_PLAN_ENDPOINTS.PLANS).flush(body, init);

      http.expectNone(BUDGET_PLAN_ENDPOINTS.PLANS);
    });

    it('sends exactly one request after a network failure: no automatic retry', () => {
      service.createMonthlyPlan(REQUEST).subscribe({ error: () => undefined });

      http.expectOne(BUDGET_PLAN_ENDPOINTS.PLANS).error(new ProgressEvent('error'));

      http.expectNone(BUDGET_PLAN_ENDPOINTS.PLANS);
    });
  });

  describe('createExpense', () => {
    it('is cold: no request until subscribed', () => {
      service.createExpense(EXPENSE_REQUEST);

      http.expectNone(BUDGET_PLAN_ENDPOINTS.EXPENSES);
    });

    it('POSTs the exact body to the expenses endpoint and passes the 201 body through', () => {
      const next = vi.fn<(value: CreateExpenseResponse) => void>();
      const error = vi.fn();

      service.createExpense(EXPENSE_REQUEST).subscribe({ next, error });

      const call = http.expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES);
      expect(call.request.method).toBe('POST');
      expect(call.request.url).not.toMatch(/\/$/);
      expect(call.request.body).toEqual(EXPENSE_REQUEST);
      expect(Object.keys(call.request.body)).not.toContain('year');
      expect(Object.keys(call.request.body)).not.toContain('month');
      expect(typeof call.request.body.amountVnd).toBe('string');
      call.flush(CREATE_EXPENSE_RESPONSE_FIXTURE, { status: 201, statusText: 'Created' });

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(CREATE_EXPENSE_RESPONSE_FIXTURE);
      expect(error).not.toHaveBeenCalled();
    });

    it('keeps money as strings, including a negative remainingVnd', () => {
      let received: CreateExpenseResponse | undefined;
      const overBudget: CreateExpenseResponse = {
        ...CREATE_EXPENSE_RESPONSE_FIXTURE,
        jarSummary: { ...CREATE_EXPENSE_RESPONSE_FIXTURE.jarSummary, remainingVnd: '-500000' }
      };

      service.createExpense(EXPENSE_REQUEST).subscribe((value) => (received = value));
      http.expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES).flush(overBudget, { status: 201, statusText: 'Created' });

      expect(received?.jarSummary.remainingVnd).toBe('-500000');
      expect(typeof received?.expense.amountVnd).toBe('string');
    });

    it('maps a 400 VALIDATION_ERROR to a validation AppError carrying the field errors', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createExpense(EXPENSE_REQUEST).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES)
        .flush(EXPENSE_VALIDATION_ERROR_FIXTURE, { status: 400, statusText: 'Bad Request' });

      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('validation');
      expect(appError.code).toBe('VALIDATION_ERROR');
      expect(appError.fieldErrors).toEqual(EXPENSE_VALIDATION_ERROR_FIXTURE.errors);
    });

    it('maps a 400 JAR_NOT_IN_MONTHLY_PLAN to a validation AppError with that code', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createExpense(EXPENSE_REQUEST).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES)
        .flush(JAR_NOT_IN_PLAN_ERROR_FIXTURE, { status: 400, statusText: 'Bad Request' });

      expect(error.mock.calls[0][0]).toEqual({
        kind: 'validation',
        status: 400,
        code: 'JAR_NOT_IN_MONTHLY_PLAN',
        message: JAR_NOT_IN_PLAN_ERROR_FIXTURE.message,
        fieldErrors: []
      });
    });

    it('maps a 404 to a not-found AppError carrying the MONTHLY_PLAN_NOT_FOUND code', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createExpense(EXPENSE_REQUEST).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES)
        .flush(NOT_FOUND_ERROR_FIXTURE, { status: 404, statusText: 'Not Found' });

      expect(error.mock.calls[0][0].kind).toBe('not-found');
      expect(error.mock.calls[0][0].code).toBe('MONTHLY_PLAN_NOT_FOUND');
    });

    it('maps a 500 to a server AppError without the raw body message', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createExpense(EXPENSE_REQUEST).subscribe({ error });
      http
        .expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES)
        .flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });

      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('server');
      expect(appError.message).toBe(GENERIC_SERVER_MESSAGE);
      expect(appError.message).not.toContain(INTERNAL_ERROR_FIXTURE.message);
    });

    it('maps a network failure to a network AppError', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.createExpense(EXPENSE_REQUEST).subscribe({ error });
      http.expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES).error(new ProgressEvent('error'));

      expect(error.mock.calls[0][0].kind).toBe('network');
      expect(error.mock.calls[0][0].status).toBe(0);
    });

    it.each([
      ['a 500', () => ({ body: INTERNAL_ERROR_FIXTURE, init: { status: 500, statusText: 'Internal Server Error' } })],
      ['a 400', () => ({ body: JAR_NOT_IN_PLAN_ERROR_FIXTURE, init: { status: 400, statusText: 'Bad Request' } })]
    ])('sends exactly one request after %s: no automatic retry', (_label, response) => {
      service.createExpense(EXPENSE_REQUEST).subscribe({ error: () => undefined });

      const { body, init } = response();
      http.expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES).flush(body, init);

      http.expectNone(BUDGET_PLAN_ENDPOINTS.EXPENSES);
    });

    it('sends exactly one request after a network failure: no automatic retry', () => {
      service.createExpense(EXPENSE_REQUEST).subscribe({ error: () => undefined });

      http.expectOne(BUDGET_PLAN_ENDPOINTS.EXPENSES).error(new ProgressEvent('error'));

      http.expectNone(BUDGET_PLAN_ENDPOINTS.EXPENSES);
    });
  });

  describe('getSpendingByJars', () => {
    const SEPTEMBER = BUDGET_PLAN_ENDPOINTS.SPENDING_BY_JARS(2026, 9);

    it('is cold: no request until subscribed', () => {
      service.getSpendingByJars(2026, 9);

      http.expectNone(SEPTEMBER);
    });

    it('issues one GET to the spending-by-jars endpoint and passes the 200 body through', () => {
      const next = vi.fn<(value: SpendingByJarsResponse) => void>();
      const error = vi.fn();

      service.getSpendingByJars(2026, 9).subscribe({ next, error });

      const call = http.expectOne(SEPTEMBER);
      expect(call.request.method).toBe('GET');
      expect(call.request.urlWithParams).toMatch(/\/api\/v1\/budget-plans\/2026\/9\/spending-by-jars$/);
      expect(call.request.body).toBeNull();
      call.flush(SPENDING_BY_JARS_FIXTURE);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(SPENDING_BY_JARS_FIXTURE);
      expect(error).not.toHaveBeenCalled();
    });

    it('builds the URL from the given year and month, so a different period is a different request', () => {
      service.getSpendingByJars(2026, 10).subscribe();

      const call = http.expectOne(BUDGET_PLAN_ENDPOINTS.SPENDING_BY_JARS(2026, 10));
      expect(call.request.urlWithParams).toMatch(/\/api\/v1\/budget-plans\/2026\/10\/spending-by-jars$/);
      call.flush(OCTOBER_SPENDING_BY_JARS_FIXTURE);
      http.expectNone(SEPTEMBER);
    });

    it('keeps the jar order, the string money and the unclamped percentages returned by the API', () => {
      let received: SpendingByJarsResponse | undefined;

      service.getSpendingByJars(2026, 9).subscribe((value) => (received = value));
      http.expectOne(SEPTEMBER).flush(NON_CANONICAL_SPENDING_BY_JARS_FIXTURE);

      expect(received?.jars.map((jar) => jar.jarType)).toEqual(
        NON_CANONICAL_SPENDING_BY_JARS_FIXTURE.jars.map((jar) => jar.jarType)
      );
      expect(received?.jars[0].jarType).toBe('entertainmentAndTravel');
      expect(received?.jars.every((jar) => typeof jar.plannedBudgetVnd === 'string')).toBe(true);
      expect(received?.jars.every((jar) => typeof jar.spentBudgetVnd === 'string')).toBe(true);
      expect(received?.jars.map((jar) => jar.percentageUsed)).toContain(125.5);
    });

    it('maps a 404 to a not-found AppError carrying the MONTHLY_PLAN_NOT_FOUND code', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getSpendingByJars(2026, 9).subscribe({ error });
      http.expectOne(SEPTEMBER).flush(NOT_FOUND_ERROR_FIXTURE, { status: 404, statusText: 'Not Found' });

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toEqual({
        kind: 'not-found',
        status: 404,
        code: 'MONTHLY_PLAN_NOT_FOUND',
        message: NOT_FOUND_ERROR_FIXTURE.message,
        fieldErrors: []
      });
    });

    it('maps a bare 404 without an envelope to a not-found AppError with no plan code', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getSpendingByJars(2026, 9).subscribe({ error });
      http.expectOne(SEPTEMBER).flush(null, { status: 404, statusText: 'Not Found' });

      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('not-found');
      expect(appError.code).toBe('UNKNOWN_ERROR');
    });

    it('maps a 400 to a validation AppError carrying the VALIDATION_ERROR code and field errors', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getSpendingByJars(2026, 9).subscribe({ error });
      http.expectOne(SEPTEMBER).flush(VALIDATION_ERROR_FIXTURE, { status: 400, statusText: 'Bad Request' });

      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('validation');
      expect(appError.status).toBe(400);
      expect(appError.code).toBe('VALIDATION_ERROR');
      expect(appError.fieldErrors).toEqual(VALIDATION_ERROR_FIXTURE.errors);
    });

    it('maps a 500 to a server AppError without the raw body message', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getSpendingByJars(2026, 9).subscribe({ error });
      http.expectOne(SEPTEMBER).flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });

      const appError = error.mock.calls[0][0];
      expect(appError.kind).toBe('server');
      expect(appError.status).toBe(500);
      expect(appError.message).toBe(GENERIC_SERVER_MESSAGE);
      expect(appError.message).not.toContain(INTERNAL_ERROR_FIXTURE.message);
    });

    it('maps a network failure to a network AppError and does not retry', () => {
      const error = vi.fn<(value: AppError) => void>();

      service.getSpendingByJars(2026, 9).subscribe({ error });
      http.expectOne(SEPTEMBER).error(new ProgressEvent('error'));

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0].kind).toBe('network');
      expect(error.mock.calls[0][0].status).toBe(0);
      expect(error.mock.calls[0][0].code).toBe('NETWORK_ERROR');
      http.expectNone(SEPTEMBER);
    });

    it('issues a new request on every subscription (no caching)', () => {
      const spending$ = service.getSpendingByJars(2026, 9);

      spending$.subscribe();
      http.expectOne(SEPTEMBER).flush(SPENDING_BY_JARS_FIXTURE);

      spending$.subscribe();
      http.expectOne(SEPTEMBER).flush(SPENDING_BY_JARS_FIXTURE);
    });

    it('does not reuse an earlier response: the second subscriber gets the newer body', () => {
      const received: SpendingByJarsResponse[] = [];
      const spending$ = service.getSpendingByJars(2026, 9);

      spending$.subscribe((value) => received.push(value));
      http.expectOne(SEPTEMBER).flush(SPENDING_BY_JARS_FIXTURE);
      spending$.subscribe((value) => received.push(value));
      http.expectOne(SEPTEMBER).flush({ ...SPENDING_BY_JARS_FIXTURE, jars: SPENDING_BY_JARS_FIXTURE.jars.slice(0, 1) });

      expect(received.map((value) => value.jars.length)).toEqual([7, 1]);
    });
  });
});
