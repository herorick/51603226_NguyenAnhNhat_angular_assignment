import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUDGET_PLAN_ENDPOINTS } from '../../../../constants/api-endpoints';
import { CreatedExpense } from '../../../../models/budget-plan.models';
import { jarColor } from '../../../../shared/constants/jar-colors';
import {
  CREATE_EXPENSE_RESPONSE_FIXTURE,
  DEFAULT_JARS_FIXTURE,
  EXPENSE_VALIDATION_ERROR_FIXTURE,
  INTERNAL_ERROR_FIXTURE,
  MONTHLY_EXPENSES_FIXTURE,
  NOT_FOUND_ERROR_FIXTURE
} from '../../../../testing/fixtures';
import { Period } from '../../../monthly-planning/utils/period';
import {
  EXPENSES_LOAD_FAILED_MESSAGE,
  EXPENSE_DELETE_FAILED_MESSAGE,
  EXPENSE_FORM_INVALID_MESSAGE,
  MonthExpensesComponent,
  lastDayOfPeriod
} from './month-expenses.component';

@Component({
  imports: [MonthExpensesComponent],
  template: `<app-month-expenses [period]="period()" />`
})
class HostComponent {
  readonly period = signal<Period>({ year: 2026, month: 9 });
}

const SEPTEMBER = BUDGET_PLAN_ENDPOINTS.EXPENSES_BY_PERIOD(2026, 9);
const OCTOBER = BUDGET_PLAN_ENDPOINTS.EXPENSES_BY_PERIOD(2026, 10);

const LOADING = 'Loading expenses…';
const EMPTY = 'No expenses recorded for this month yet.';
const NETWORK_FAILED = 'We could not reach the server. Check your connection and try again.';

interface RowSnapshot {
  day: string;
  description: string;
  jar: string;
  amount: string;
}

const text = (element: Element | null): string => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

interface View {
  fixture: ComponentFixture<HostComponent>;
  root: HTMLElement;
  http: HttpTestingController;
}

const render = (view: View): void => view.fixture.detectChanges();

const createView = (): View => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement, http: TestBed.inject(HttpTestingController) };
};

const rows = (view: View): RowSnapshot[] =>
  Array.from(view.root.querySelectorAll('.expense-row')).map((row) => ({
    day: text(row.querySelector('.expense-day')),
    description: text(row.querySelector('.expense-description')),
    jar: text(row.querySelector('.expense-jar')),
    amount: text(row.querySelector('.expense-amount'))
  }));

const alert = (view: View): Element | null => view.root.querySelector('[role=alert]');
const retryButton = (view: View): HTMLButtonElement | null => view.root.querySelector('button');

const expense = (patch: Partial<CreatedExpense>): CreatedExpense => ({ ...MONTHLY_EXPENSES_FIXTURE.expenses[0], ...patch });

describe('MonthExpensesComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('loading', () => {
    it('sends one GET for the period and shows the loading text until it answers', () => {
      const view = createView();

      const call = view.http.expectOne(SEPTEMBER);
      expect(call.request.method).toBe('GET');
      expect(text(view.root.querySelector('h2'))).toBe('Expenses this month');
      expect(text(view.root.querySelector('[aria-busy=true]'))).toBe(LOADING);
      expect(rows(view)).toHaveLength(0);
      expect(alert(view)).toBeNull();

      call.flush(MONTHLY_EXPENSES_FIXTURE);
      render(view);

      expect(view.root.querySelector('[aria-busy=true]')).toBeNull();
      expect(view.root.textContent).not.toContain(LOADING);
    });

    it('exposes no rows and no error message while loading', () => {
      const view = createView();
      const component = view.fixture.debugElement.query(By.directive(MonthExpensesComponent))
        .componentInstance as MonthExpensesComponent;

      expect(component.status()).toBe('loading');
      expect(component.rows()).toEqual([]);
      expect(component.errorMessage()).toBe('');
      view.http.expectOne(SEPTEMBER).flush(MONTHLY_EXPENSES_FIXTURE);
    });
  });

  describe('ready', () => {
    it('renders one row per expense in response order with day, description, jar and amount', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush(MONTHLY_EXPENSES_FIXTURE);
      render(view);

      // en-GB abbreviates September as "Sept" in current ICU data (older data: "Sep"), so the month is matched loosely.
      expect(rows(view)).toEqual([
        {
          day: '15 Sep',
          description: 'Weekly groceries',
          jar: 'Food',
          amount: '1,250,000 VND'
        },
        { day: '05 Sep', description: 'Rent', jar: 'Living Expenses', amount: '8,000,000 VND' }
      ]);
      expect(view.root.querySelector('ul.expense-list')?.getAttribute('role')).toBe('list');
      expect(view.root.textContent).not.toContain(EMPTY);
    });

    it('colours each row with its jar colour token', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush(MONTHLY_EXPENSES_FIXTURE);
      render(view);

      const styles = Array.from(view.root.querySelectorAll<HTMLElement>('.expense-row')).map((row) =>
        row.style.getPropertyValue('--jar-color')
      );
      expect(styles).toEqual([jarColor('food'), jarColor('livingExpenses')]);
    });

    it.each([
      ['2026-01-01', '01 Jan'],
      ['2026-12-31', '31 Dec'],
      ['2024-02-29', '29 Feb']
    ])('labels %s as %s whatever the time zone', (expenseDate, expected) => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush({ ...MONTHLY_EXPENSES_FIXTURE, expenses: [expense({ expenseDate })] });
      render(view);

      expect(rows(view)[0].day).toBe(expected);
    });

    it('shows an unparseable date as it was received instead of a wrong day', () => {
      const view = createView();
      view.http
        .expectOne(SEPTEMBER)
        .flush({ ...MONTHLY_EXPENSES_FIXTURE, expenses: [expense({ expenseDate: 'not-a-date' })] });
      render(view);

      expect(rows(view)[0].day).toBe('not-a-date');
    });

    it('shows a non-digit amount as received', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush({ ...MONTHLY_EXPENSES_FIXTURE, expenses: [expense({ amountVnd: 'n/a' })] });
      render(view);

      expect(rows(view)[0].amount).toBe('n/a');
    });

    it('shows the empty state when the month has no expense', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush({ ...MONTHLY_EXPENSES_FIXTURE, expenses: [] });
      render(view);

      expect(text(view.root.querySelector('.muted'))).toBe(EMPTY);
      expect(view.root.querySelector('ul')).toBeNull();
      expect(alert(view)).toBeNull();
    });
  });

  describe('errors', () => {
    it('shows the generic message for a 500, never the raw body', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });
      render(view);

      expect(text(alert(view)?.querySelector('p') ?? null)).toBe(EXPENSES_LOAD_FAILED_MESSAGE);
      expect(view.root.textContent).not.toContain(INTERNAL_ERROR_FIXTURE.message);
      expect(rows(view)).toHaveLength(0);
    });

    it('shows the generic message for a 404', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush(NOT_FOUND_ERROR_FIXTURE, { status: 404, statusText: 'Not Found' });
      render(view);

      expect(text(alert(view)?.querySelector('p') ?? null)).toBe(EXPENSES_LOAD_FAILED_MESSAGE);
    });

    it('shows the network message when the server cannot be reached', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).error(new ProgressEvent('error'));
      render(view);

      expect(text(alert(view)?.querySelector('p') ?? null)).toBe(NETWORK_FAILED);
    });

    it.each<[string, object | null]>([
      ['a null body', null],
      ['a body without expenses', { ...MONTHLY_EXPENSES_FIXTURE, expenses: undefined }],
      ['expenses that are not a list', { ...MONTHLY_EXPENSES_FIXTURE, expenses: {} }]
    ])('treats %s as a failed load', (_label, body) => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush(body);
      render(view);

      expect(text(alert(view)?.querySelector('p') ?? null)).toBe(EXPENSES_LOAD_FAILED_MESSAGE);
      expect(rows(view)).toHaveLength(0);
    });

    it('Try again shows loading, re-issues exactly one GET for the same period and renders the answer', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).error(new ProgressEvent('error'));
      render(view);

      retryButton(view)?.click();
      render(view);

      expect(text(view.root.querySelector('[aria-busy=true]'))).toBe(LOADING);
      expect(alert(view)).toBeNull();
      view.http.expectOne(SEPTEMBER).flush(MONTHLY_EXPENSES_FIXTURE);
      render(view);

      expect(rows(view)).toHaveLength(2);
      expect(alert(view)).toBeNull();
    });

    it('can fail again after a retry', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).error(new ProgressEvent('error'));
      render(view);

      retryButton(view)?.click();
      render(view);
      view.http.expectOne(SEPTEMBER).flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });
      render(view);

      expect(text(alert(view)?.querySelector('p') ?? null)).toBe(EXPENSES_LOAD_FAILED_MESSAGE);
      expect(retryButton(view)).not.toBeNull();
    });
  });

  describe('period changes', () => {
    it('fetches the new period and replaces the previous rows', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush(MONTHLY_EXPENSES_FIXTURE);
      render(view);

      view.fixture.componentInstance.period.set({ year: 2026, month: 10 });
      render(view);

      expect(text(view.root.querySelector('[aria-busy=true]'))).toBe(LOADING);
      expect(rows(view)).toHaveLength(0);
      view.http
        .expectOne(OCTOBER)
        .flush({
          ...MONTHLY_EXPENSES_FIXTURE,
          month: 10,
          expenses: [expense({ id: 20, expenseDate: '2026-10-02', description: 'Fuel' })]
        });
      render(view);

      expect(rows(view).map((row) => [row.day, row.description])).toEqual([['02 Oct', 'Fuel']]);
    });

    it('cancels the request of the previous period when the period changes before it answers', () => {
      const view = createView();
      const september = view.http.expectOne(SEPTEMBER);

      view.fixture.componentInstance.period.set({ year: 2026, month: 10 });
      render(view);

      expect(september.cancelled).toBe(true);
      view.http.expectOne(OCTOBER).flush({ ...MONTHLY_EXPENSES_FIXTURE, month: 10, expenses: [] });
      render(view);

      expect(text(view.root.querySelector('.muted'))).toBe(EMPTY);
    });

    it('retries the current period, not the first one', () => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush(MONTHLY_EXPENSES_FIXTURE);
      render(view);
      view.fixture.componentInstance.period.set({ year: 2026, month: 10 });
      render(view);
      view.http.expectOne(OCTOBER).error(new ProgressEvent('error'));
      render(view);

      retryButton(view)?.click();
      render(view);

      view.http.expectNone(SEPTEMBER);
      view.http.expectOne(OCTOBER).flush({ ...MONTHLY_EXPENSES_FIXTURE, month: 10, expenses: [] });
      render(view);
      expect(text(view.root.querySelector('.muted'))).toBe(EMPTY);
    });
  });

  describe('editing and deleting', () => {
    const ROW_11 = BUDGET_PLAN_ENDPOINTS.EXPENSE_BY_ID(11);

    const ready = (): View => {
      const view = createView();
      view.http.expectOne(SEPTEMBER).flush(MONTHLY_EXPENSES_FIXTURE);
      render(view);
      return view;
    };

    const clickAction = (view: View, label: string): void => {
      const button = view.root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      if (button === null) {
        throw new Error(`No button "${label}"`);
      }
      button.click();
      render(view);
    };

    const field = <T extends HTMLElement>(view: View, selector: string): T => {
      const element = view.root.querySelector<T>(`.edit-form ${selector}`);
      if (element === null) {
        throw new Error(`No ${selector} in the edit form`);
      }
      return element;
    };

    const typeInto = (input: HTMLInputElement, value: string): void => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };

    const changed = (view: View): { count: number } => {
      const counter = { count: 0 };
      const component = view.fixture.debugElement.query(By.directive(MonthExpensesComponent))
        .componentInstance as MonthExpensesComponent;
      component.changed.subscribe(() => counter.count++);
      return counter;
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('Edit opens a form pre-filled with the expense, grouped amount included', () => {
      const view = ready();

      clickAction(view, 'Edit Weekly groceries');
      view.http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).flush(DEFAULT_JARS_FIXTURE);
      render(view);

      expect(field<HTMLInputElement>(view, 'input[type=date]').value).toBe('2026-09-15');
      expect(field<HTMLInputElement>(view, 'input[type=date]').min).toBe('2026-09-01');
      expect(field<HTMLInputElement>(view, 'input[type=date]').max).toBe('2026-09-30');
      expect(field<HTMLSelectElement>(view, 'select').value).toBe('food');
      expect(field<HTMLSelectElement>(view, 'select').options).toHaveLength(DEFAULT_JARS_FIXTURE.jars.length);
      expect(field<HTMLInputElement>(view, 'input[formControlName=amountVnd]').value).toBe('1,250,000');
      expect(field<HTMLInputElement>(view, 'input[formControlName=description]').value).toBe('Weekly groceries');
    });

    it('Save sends PUT with plain digits, then reloads the list quietly and emits changed', () => {
      const view = ready();
      const counter = changed(view);
      clickAction(view, 'Edit Weekly groceries');
      view.http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).flush(DEFAULT_JARS_FIXTURE);
      render(view);

      typeInto(field<HTMLInputElement>(view, 'input[formControlName=amountVnd]'), '5000000');
      typeInto(field<HTMLInputElement>(view, 'input[formControlName=description]'), '  Groceries  ');
      field<HTMLFormElement>(view, '').dispatchEvent(new Event('submit'));
      render(view);

      const put = view.http.expectOne(ROW_11);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({
        expenseDate: '2026-09-15',
        jarType: 'food',
        amountVnd: '5000000',
        description: 'Groceries'
      });
      put.flush({
        ...CREATE_EXPENSE_RESPONSE_FIXTURE,
        expense: { ...CREATE_EXPENSE_RESPONSE_FIXTURE.expense, id: 11, amountVnd: '5000000', description: 'Groceries' }
      });
      render(view);

      expect(view.root.querySelector('.edit-form')).toBeNull();
      expect(text(view.root.querySelector('.expenses-notice'))).toBe('Expense updated: Groceries, 5,000,000 VND.');
      expect(counter.count).toBe(1);
      // Quiet reload: the rows stay while the fresh list is fetched.
      expect(view.root.querySelector('[aria-busy=true]')).toBeNull();
      expect(rows(view)).toHaveLength(2);
      view.http.expectOne(SEPTEMBER).flush({
        ...MONTHLY_EXPENSES_FIXTURE,
        expenses: [expense({ amountVnd: '5000000', description: 'Groceries' }), MONTHLY_EXPENSES_FIXTURE.expenses[1]]
      });
      render(view);

      expect(rows(view)[0]).toMatchObject({ description: 'Groceries', amount: '5,000,000 VND' });
    });

    it('does not send a PUT while the form is invalid', () => {
      const view = ready();
      clickAction(view, 'Edit Weekly groceries');
      view.http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).flush(DEFAULT_JARS_FIXTURE);
      render(view);

      typeInto(field<HTMLInputElement>(view, 'input[formControlName=amountVnd]'), '0');
      field<HTMLFormElement>(view, '').dispatchEvent(new Event('submit'));
      render(view);

      view.http.expectNone(ROW_11);
      expect(text(view.root.querySelector('.row-error'))).toBe(EXPENSE_FORM_INVALID_MESSAGE);
    });

    it('keeps the form open and shows the API message when the PUT is rejected', () => {
      const view = ready();
      clickAction(view, 'Edit Weekly groceries');
      view.http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).flush(DEFAULT_JARS_FIXTURE);
      render(view);

      field<HTMLFormElement>(view, '').dispatchEvent(new Event('submit'));
      render(view);
      view.http.expectOne(ROW_11).flush(EXPENSE_VALIDATION_ERROR_FIXTURE, { status: 400, statusText: 'Bad Request' });
      render(view);

      expect(view.root.querySelector('.edit-form')).not.toBeNull();
      expect(text(view.root.querySelector('.row-error'))).toBe(EXPENSE_VALIDATION_ERROR_FIXTURE.errors[0].message);
    });

    it('Cancel closes the form without a request', () => {
      const view = ready();
      clickAction(view, 'Edit Weekly groceries');
      view.http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).flush(DEFAULT_JARS_FIXTURE);
      render(view);

      const cancel = Array.from(view.root.querySelectorAll<HTMLButtonElement>('.edit-form button')).find(
        (button) => text(button) === 'Cancel'
      );
      cancel?.click();
      render(view);

      expect(view.root.querySelector('.edit-form')).toBeNull();
      expect(rows(view)).toHaveLength(2);
    });

    it('offers the expense jar when the jar catalog cannot be loaded', () => {
      const view = ready();
      clickAction(view, 'Edit Weekly groceries');
      view.http.expectOne(BUDGET_PLAN_ENDPOINTS.DEFAULT_JARS).error(new ProgressEvent('error'));
      render(view);

      const select = field<HTMLSelectElement>(view, 'select');
      expect(Array.from(select.options).map((option) => option.value)).toEqual(['food']);
    });

    it('Delete asks first and does nothing when declined', () => {
      const view = ready();
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      clickAction(view, 'Delete Weekly groceries');

      expect(confirm).toHaveBeenCalledWith('Delete "Weekly groceries" (1,250,000 VND)? This cannot be undone.');
      view.http.expectNone(ROW_11);
    });

    it('Delete sends DELETE, reloads quietly and emits changed', () => {
      const view = ready();
      const counter = changed(view);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      clickAction(view, 'Delete Weekly groceries');
      const call = view.http.expectOne(ROW_11);
      expect(call.request.method).toBe('DELETE');
      call.flush(null, { status: 204, statusText: 'No Content' });
      render(view);

      expect(text(view.root.querySelector('.expenses-notice'))).toBe('Expense deleted: Weekly groceries.');
      expect(counter.count).toBe(1);
      view.http.expectOne(SEPTEMBER).flush({ ...MONTHLY_EXPENSES_FIXTURE, expenses: [MONTHLY_EXPENSES_FIXTURE.expenses[1]] });
      render(view);

      expect(rows(view).map((row) => row.description)).toEqual(['Rent']);
    });

    it('treats a 404 on delete as already deleted', () => {
      const view = ready();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      clickAction(view, 'Delete Weekly groceries');
      view.http.expectOne(ROW_11).flush(NOT_FOUND_ERROR_FIXTURE, { status: 404, statusText: 'Not Found' });
      render(view);

      expect(view.root.querySelector('.row-error')).toBeNull();
      view.http.expectOne(SEPTEMBER).flush(MONTHLY_EXPENSES_FIXTURE);
    });

    it('shows a row error when the delete fails', () => {
      const view = ready();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      clickAction(view, 'Delete Weekly groceries');
      view.http.expectOne(ROW_11).flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });
      render(view);

      expect(text(view.root.querySelector('.row-error'))).toBe(EXPENSE_DELETE_FAILED_MESSAGE);
      expect(rows(view)).toHaveLength(2);
    });
  });
});

describe('lastDayOfPeriod', () => {
  it.each([
    [{ year: 2026, month: 9 }, '2026-09-30'],
    [{ year: 2026, month: 2 }, '2026-02-28'],
    [{ year: 2028, month: 2 }, '2028-02-29'],
    [{ year: 2100, month: 2 }, '2100-02-28'],
    [{ year: 2000, month: 2 }, '2000-02-29'],
    [{ year: 2026, month: 12 }, '2026-12-31']
  ])('%j -> %s', (period, expected) => {
    expect(lastDayOfPeriod(period)).toBe(expected);
  });
});
