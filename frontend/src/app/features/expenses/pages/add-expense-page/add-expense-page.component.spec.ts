import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUDGET_PLAN_ENDPOINTS } from '../../../../constants/api-endpoints';
import { ApiErrorResponse } from '../../../../models/api-error.models';
import { CreateExpenseResponse, MonthlyPlanResponse } from '../../../../models/budget-plan.models';
import {
  CREATE_EXPENSE_RESPONSE_FIXTURE,
  EXPENSE_VALIDATION_ERROR_FIXTURE,
  INTERNAL_ERROR_FIXTURE,
  JAR_NOT_IN_PLAN_ERROR_FIXTURE,
  MONTHLY_PLAN_FIXTURE,
  NON_CANONICAL_MONTHLY_PLAN_FIXTURE,
  NOT_FOUND_ERROR_FIXTURE,
  OCTOBER_PLAN_FIXTURE,
  OVER_BUDGET_EXPENSE_RESPONSE_FIXTURE
} from '../../../../testing/fixtures';
import { AddExpensePageComponent, PLAN_LOAD_DELAY_MS, PLAN_UNAVAILABLE_MESSAGE } from './add-expense-page.component';

const { BY_PERIOD, EXPENSES } = BUDGET_PLAN_ENDPOINTS;

const SEPTEMBER = BY_PERIOD(2026, 9);
const OCTOBER = BY_PERIOD(2026, 10);
const NOVEMBER = BY_PERIOD(2026, 11);

const LOADING = 'Loading jars for the selected month…';
const IDLE_HINT = 'Select an expense date to load the jars.';
const NOT_FOUND_TITLE = 'Create a monthly plan before adding an expense';
const PLAN_LOAD_FAILED = 'We could not load the jars for this month. Please try again.';
const INTEGRITY_FAILED = 'The monthly plan data is incomplete or invalid. Please try again.';
const NETWORK_FAILED = 'We could not reach the server. Check your connection and try again.';
const SAVE_FAILED = 'We could not save your expense. Your values are kept, please try again.';
const SAVING = 'Saving your expense…';
const SUMMARY = 'Please complete the required expense details.';
const DATE_ERROR = 'Select a valid expense date.';
const JAR_ERROR = 'Please select a jar.';
const AMOUNT_ERROR = 'Enter a positive whole-VND amount.';
const AMOUNT_ZERO = 'Amount must be greater than zero.';
const DESCRIPTION_REQUIRED = 'Description is required.';
const DESCRIPTION_TOO_LONG = 'Description must be 500 characters or fewer.';
const PLACEHOLDER = 'Select a jar';

const EXPECTED_BODY = {
  expenseDate: '2026-09-15',
  jarType: 'food',
  amountVnd: '1250000',
  description: 'Weekly groceries'
};

type Body = object | string | null;

/** A plan for another month with budgets that differ from every other fixture, to catch any cross-month reuse. */
const NOVEMBER_PLAN: MonthlyPlanResponse = {
  ...OCTOBER_PLAN_FIXTURE,
  id: 3,
  month: 11,
  jars: OCTOBER_PLAN_FIXTURE.jars.map((jar, index) => ({ ...jar, budgetVnd: String(3000000 * (index + 1)) }))
};

const LEAP_PLAN: MonthlyPlanResponse = { ...MONTHLY_PLAN_FIXTURE, id: 4, year: 2024, month: 2 };

const FRACTIONAL_PLAN: MonthlyPlanResponse = {
  ...MONTHLY_PLAN_FIXTURE,
  jars: MONTHLY_PLAN_FIXTURE.jars.map((jar, index) => (index === 0 ? { ...jar, percentage: 33.333 } : jar))
};

const UNKNOWN_FIELD_ERROR: ApiErrorResponse = {
  code: 'VALIDATION_ERROR',
  message: 'The request body is invalid.',
  errors: [{ field: 'year', code: 'OUT_OF_RANGE', message: 'Year is out of range.' }]
};

const ALL_FIELDS_ERROR: ApiErrorResponse = {
  code: 'VALIDATION_ERROR',
  message: 'One or more fields are invalid.',
  errors: [
    { field: 'description', code: 'REQUIRED', message: 'Server: description is required.' },
    { field: 'amountVnd', code: 'MUST_BE_POSITIVE', message: 'Server: amount first.' },
    { field: 'amountVnd', code: 'TOO_LARGE', message: 'Server: amount second.' },
    { field: 'jarType', code: 'INVALID', message: 'Server: jar is invalid.' },
    { field: 'expenseDate', code: 'INVALID', message: 'Server: date is invalid.' },
    { field: 'unknownField', code: 'INVALID', message: 'Server: not a control.' }
  ]
};

const MALFORMED_PLANS: [string, Body][] = [
  ['six jars instead of seven', { ...MONTHLY_PLAN_FIXTURE, jars: MONTHLY_PLAN_FIXTURE.jars.slice(1) }],
  ['a numeric budget', { ...MONTHLY_PLAN_FIXTURE, jars: [{ ...MONTHLY_PLAN_FIXTURE.jars[0], budgetVnd: 8750000 }] }],
  [
    'a duplicated jar',
    { ...MONTHLY_PLAN_FIXTURE, jars: Array.from({ length: 7 }, () => MONTHLY_PLAN_FIXTURE.jars[0]) }
  ],
  ['an empty body', null]
];

// ---------------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------------

interface Page {
  harness: RouterTestingHarness;
  component: AddExpensePageComponent;
  http: HttpTestingController;
  root: HTMLElement;
}

interface PageOptions {
  url?: string;
  plan?: MonthlyPlanResponse;
}

const text = (node: Element | null | undefined): string => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

const el = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`Element not found: ${selector}`);
  }
  return found;
};

const els = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

const dateInput = (page: Page): HTMLInputElement => el<HTMLInputElement>(page.root, '#expense-date');
const jarSelect = (page: Page): HTMLSelectElement => el<HTMLSelectElement>(page.root, '#expense-jar');
const amountInput = (page: Page): HTMLInputElement => el<HTMLInputElement>(page.root, '#expense-amount');
const descriptionInput = (page: Page): HTMLInputElement => el<HTMLInputElement>(page.root, '#expense-description');
const form = (page: Page): HTMLFormElement => el<HTMLFormElement>(page.root, 'form');
const saveButton = (page: Page): HTMLButtonElement => el<HTMLButtonElement>(page.root, 'button[type=submit]');

const optionLabels = (page: Page): string[] => els<HTMLOptionElement>(jarSelect(page), 'option').map(text);
const optionValues = (page: Page): string[] =>
  els<HTMLOptionElement>(jarSelect(page), 'option').map((option) => option.value);
/** Text of every `role=alert`; an alert made of several elements (message + link/button) joins them with a space. */
const alertTexts = (page: Page): string[] =>
  els(page.root, '[role=alert]').map((alert) =>
    alert.children.length > 0 ? Array.from(alert.children).map(text).join(' ') : text(alert)
  );
const statusSummary = (page: Page): string => text(el(page.root, '.status-message'));
const loadingHint = (page: Page): string => text(el(page.root, '.field-hint[role=status]'));
const saveResult = (page: Page): string => text(el(page.root, '.save-result'));
const pageText = (page: Page): string => text(page.root);

const link = (page: Page, label: string): HTMLAnchorElement => {
  const found = els<HTMLAnchorElement>(page.root, 'a').find((anchor) => text(anchor).includes(label));
  if (!found) {
    throw new Error(`Link not found: ${label}`);
  }
  return found;
};

const retryButton = (page: Page): HTMLButtonElement => {
  const found = els<HTMLButtonElement>(page.root, 'button').find((button) => text(button) === 'Try again');
  if (!found) {
    throw new Error('Try again button not found');
  }
  return found;
};

/** `<dt>` to `<dd>` text of every fact inside `scope`. */
const facts = (page: Page, scope: string): Record<string, string> =>
  Object.fromEntries(els(page.root, `${scope} .fact`).map((fact) => [text(el(fact, 'dt')), text(el(fact, 'dd'))]));

const jarTotals = (page: Page): Record<string, string> => facts(page, '.jar-totals');
const selectedJarName = (page: Page): string => text(el(page.root, '.summary-panel .jar-summary .jar-name'));

/** Runs change detection after a synchronous action. Everything here is synchronous: no timers, no microtasks. */
const render = (page: Page): void => page.harness.detectChanges();

const enter = (page: Page, input: HTMLInputElement, value: string): void => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  render(page);
};

/** Moves the fake clock forward, for the plan GET that waits for the date to stop changing. */
const elapse = (page: Page, ms = PLAN_LOAD_DELAY_MS): void => {
  vi.advanceTimersByTime(ms);
  render(page);
};

/** Types a date and waits for the typing to settle, so the GET for its month has been sent (if the month changed). */
const enterDate = (page: Page, value: string): void => {
  enter(page, dateInput(page), value);
  elapse(page);
};

const blur = (page: Page, input: HTMLInputElement): void => {
  input.dispatchEvent(new Event('blur'));
  render(page);
};

const choose = (page: Page, jarType: string): void => {
  const select = jarSelect(page);
  select.value = jarType;
  select.dispatchEvent(new Event('change'));
  render(page);
};

const fillValid = (page: Page, amount = '1,250,000', description = 'Weekly groceries'): void => {
  choose(page, 'food');
  enter(page, amountInput(page), amount);
  enter(page, descriptionInput(page), description);
};

const save = (page: Page): void => {
  saveButton(page).click();
  render(page);
};

/** The form `submit` event, for the cases where the Save button is disabled and cannot be clicked. */
const submitForm = (page: Page): void => {
  form(page).dispatchEvent(new Event('submit'));
  render(page);
};

const createPage = async (url = '/expenses/new'): Promise<Page> => {
  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(url, AddExpensePageComponent);
  harness.detectChanges();
  const root = harness.routeNativeElement;
  if (root === null) {
    throw new Error('The routed page was not rendered');
  }
  return { harness, component, http: TestBed.inject(HttpTestingController), root };
};

const planUrl = (plan: MonthlyPlanResponse): string => BY_PERIOD(plan.year, plan.month);

const flushOk = (page: Page, body: Body, url: string): void => {
  page.http.expectOne(url).flush(body);
  render(page);
};

const flushFailure = (page: Page, url: string, status: number, statusText: string, body: Body): void => {
  page.http.expectOne(url).flush(body, { status, statusText });
  render(page);
};

const flushNetworkError = (page: Page, url: string): void => {
  page.http.expectOne(url).error(new ProgressEvent('error'));
  render(page);
};

/** Opens the page and answers the plan GET for the month the date points at. */
const readyPage = async ({ url, plan = MONTHLY_PLAN_FIXTURE }: PageOptions = {}): Promise<Page> => {
  const page = await createPage(url);
  flushOk(page, plan, planUrl(plan));
  return page;
};

/** Every request that has not been answered yet, as `METHOD url`. Empty means the page sent nothing. */
const pending = (page: Page): string[] =>
  page.http.match(() => true).map((request) => `${request.request.method} ${request.request.url}`);

const postRequest = (page: Page): TestRequest => {
  const request = page.http.expectOne(EXPENSES);
  expect(request.request.method).toBe('POST');
  return request;
};

const flushCreated = (page: Page, body: CreateExpenseResponse = CREATE_EXPENSE_RESPONSE_FIXTURE): void => {
  postRequest(page).flush(body, { status: 201, statusText: 'Created' });
  render(page);
};

const flushPostFailure = (page: Page, status: number, statusText: string, body: Body): void => {
  postRequest(page).flush(body, { status, statusText });
  render(page);
};

/** Fills the form and saves, leaving the POST outstanding. */
const savePending = async (): Promise<Page> => {
  const page = await readyPage();
  fillValid(page);
  save(page);
  return page;
};

const expectLinkedError = (page: Page, control: HTMLElement, errorId: string, message: string): void => {
  expect(control.getAttribute('aria-invalid')).toBe('true');
  expect(control.getAttribute('aria-describedby')).toBe(errorId);
  const error = el(page.root, `#${errorId}`);
  expect(error.getAttribute('role')).toBe('alert');
  expect(text(error)).toBe(message);
};

const expectNoError = (page: Page, control: HTMLElement, errorId: string): void => {
  expect(control.hasAttribute('aria-invalid')).toBe(false);
  expect(control.hasAttribute('aria-describedby')).toBe(false);
  expect(page.root.querySelector(`#${errorId}`)).toBeNull();
};

/** No jar can be picked: the select is locked and holds only the placeholder. */
const expectNoJars = (page: Page): void => {
  expect(optionLabels(page)).toEqual([PLACEHOLDER]);
  expect(jarSelect(page).disabled).toBe(true);
  expect(jarSelect(page).value).toBe('');
};

const expectMissingPlanState = (page: Page, periodLabel: string): void => {
  const alerts = alertTexts(page);
  expect(alerts).toHaveLength(1);
  expect(alerts[0]).toContain(NOT_FOUND_TITLE);
  expect(alerts[0]).toContain(`There is no monthly plan for ${periodLabel} yet.`);
  expect(link(page, 'Create a plan').getAttribute('href')).toBe('/monthly-planning');
  expectNoJars(page);
};

// ---------------------------------------------------------------------------------------------------------------------

describe('AddExpensePageComponent', () => {
  beforeEach(() => {
    // "Today" is fixed so the default expense date, and so the month that is requested, is known.
    // The plan GET after a date change is delayed with an rxjs `timer`, which runs on `setInterval`.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 8, 15, 10, 30, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'expenses/new', component: AddExpensePageComponent },
          { path: 'dashboard', children: [] },
          { path: 'monthly-planning', children: [] }
        ]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  describe('initial load (TC_F3_001, AC1)', () => {
    it('requests the plan of the current month once, with a GET, and sends no POST', async () => {
      const page = await createPage();

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.method).toBe('GET');
      expect(request.request.body).toBeNull();
      page.http.expectNone(EXPENSES);

      request.flush(MONTHLY_PLAN_FIXTURE);
    });

    it('defaults the expense date to today', async () => {
      const page = await readyPage();

      expect(dateInput(page).value).toBe('2026-09-15');
    });

    it('uses the local date, not the UTC date, just after local midnight', async () => {
      // In a timezone ahead of UTC (for example UTC+7), `toISOString` would still say 30 September here.
      vi.setSystemTime(new Date(2026, 9, 1, 0, 30, 0));

      const page = await createPage();

      expect(dateInput(page).value).toBe('2026-10-01');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);
    });

    it('shows the loading state with the jar select and Save disabled, and no jars', async () => {
      const page = await createPage();

      expect(loadingHint(page)).toBe(LOADING);
      expect(el(page.root, '.field-hint[role=status]').getAttribute('aria-live')).toBe('polite');
      expectNoJars(page);
      expect(saveButton(page).disabled).toBe(true);
      expect(selectedJarName(page)).toBe(PLACEHOLDER);

      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(loadingHint(page)).toBe('');
      expect(jarSelect(page).disabled).toBe(false);
      expect(saveButton(page).disabled).toBe(false);
    });

    it('keeps Save disabled while loading and does not send anything when the form is submitted', async () => {
      const page = await createPage();

      submitForm(page);

      expect(pending(page)).toEqual([`GET ${SEPTEMBER}`]);
      expect(alertTexts(page)).toEqual([]);
    });

    it('renders the jars from plan.jars in the canonical response order as "{name} · {percentage}%"', async () => {
      const page = await readyPage();

      expect(optionLabels(page)).toEqual([
        PLACEHOLDER,
        'Living Expenses · 35%',
        'Food · 20%',
        'Children · 10%',
        'Emergency Fund · 10%',
        'Savings · 10%',
        'Investment · 10%',
        'Entertainment & Travel · 5%'
      ]);
      expect(optionValues(page)).toEqual(['', ...MONTHLY_PLAN_FIXTURE.jars.map((jar) => jar.jarType)]);
    });

    it('never sorts: a non-canonical response order is rendered as returned', async () => {
      const page = await readyPage({ plan: NON_CANONICAL_MONTHLY_PLAN_FIXTURE });

      expect(optionValues(page)).toEqual(['', ...NON_CANONICAL_MONTHLY_PLAN_FIXTURE.jars.map((jar) => jar.jarType)]);
      expect(optionLabels(page)).toEqual([
        PLACEHOLDER,
        'Entertainment & Travel · 5%',
        'Investment · 10%',
        'Savings · 10%',
        'Emergency Fund · 10%',
        'Children · 10%',
        'Food · 20%',
        'Living Expenses · 35%'
      ]);
    });

    it('shows at most two decimals in the option percentage, without rounding it away', async () => {
      const page = await readyPage({ plan: FRACTIONAL_PLAN });

      expect(optionLabels(page)[1]).toBe('Living Expenses · 33.33%');
    });

    it('starts with no selected jar, no totals and no errors', async () => {
      const page = await readyPage();

      expect(jarSelect(page).value).toBe('');
      expect(selectedJarName(page)).toBe(PLACEHOLDER);
      expect(pageText(page)).toContain('Jar spending totals refresh after the expense is saved.');
      expect(jarTotals(page)).toEqual({});
      expect(alertTexts(page)).toEqual([]);
      expect(statusSummary(page)).toBe('');
      expect(saveResult(page)).toBe('');
    });

    it('shows the plan budget of the selected jar from the loaded plan', async () => {
      const page = await readyPage();

      choose(page, 'food');

      expect(selectedJarName(page)).toBe('Food');
      expect(facts(page, '.summary-panel .jar-summary')).toEqual({ Rate: '20%', 'Plan budget': '5,000,000 VND' });
      expect(jarTotals(page)).toEqual({});

      choose(page, 'children');

      expect(selectedJarName(page)).toBe('Children');
      expect(facts(page, '.summary-panel .jar-summary')).toEqual({ Rate: '10%', 'Plan budget': '2,500,000 VND' });
    });

    it('has a title and a back link to the dashboard', async () => {
      const page = await readyPage();

      expect(text(el(page.root, 'h1'))).toBe('Add an expense');
      expect(link(page, 'Back to expenses').getAttribute('href')).toBe('/dashboard');
    });
  });

  describe('accessible form controls (TC_F3_012)', () => {
    it('labels every control and marks them required', async () => {
      const page = await readyPage();

      for (const [id, label] of [
        ['expense-date', 'Expense date'],
        ['expense-jar', 'Jar'],
        ['expense-amount', 'Amount'],
        ['expense-description', 'Description']
      ]) {
        expect(text(el(page.root, `label[for="${id}"]`))).toContain(label);
        expect(el(page.root, `#${id}`).getAttribute('aria-required')).toBe('true');
      }
    });

    it('uses the right control types and a VND suffix on the amount', async () => {
      const page = await readyPage();

      expect(dateInput(page).type).toBe('date');
      expect(amountInput(page).type).toBe('text');
      expect(amountInput(page).getAttribute('inputmode')).toBe('numeric');
      expect(text(el(page.root, '.currency-suffix'))).toBe('VND');
    });

    it('keeps the DOM order date, jar, amount, description, Save, so tab order follows the reading order', async () => {
      const page = await readyPage();

      const order = els(page.root, 'form input, form select, form button').map(
        (control) => control.id || control.tagName
      );

      expect(order).toEqual(['expense-date', 'expense-jar', 'expense-amount', 'expense-description', 'BUTTON']);
      expect(saveButton(page).type).toBe('submit');
    });

    it('has polite live regions for the loading text, the validation summary and the save result', async () => {
      const page = await readyPage();

      expect(el(page.root, '.save-result').getAttribute('role')).toBe('status');
      expect(el(page.root, '.save-result').getAttribute('aria-live')).toBe('polite');
      expect(el(page.root, '.status-message').getAttribute('role')).toBe('status');
      expect(el(page.root, '.status-message').getAttribute('aria-live')).toBe('polite');
      expect(el(page.root, '.jar-totals').getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('query params', () => {
    it('preselects the date and the jar once the plan has loaded', async () => {
      const page = await createPage('/expenses/new?expenseDate=2026-09-01&jarType=food');

      expect(dateInput(page).value).toBe('2026-09-01');
      expect(jarSelect(page).value).toBe('');

      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(jarSelect(page).value).toBe('food');
      expect(selectedJarName(page)).toBe('Food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('5,000,000 VND');
    });

    it('loads the month of the expenseDate query param, not the current month', async () => {
      const page = await createPage('/expenses/new?expenseDate=2026-10-01');

      expect(pending(page)).toEqual([`GET ${OCTOBER}`]);
      expect(dateInput(page).value).toBe('2026-10-01');
    });

    it('requests the plan once even when a jarType is present', async () => {
      const page = await createPage('/expenses/new?expenseDate=2026-10-01&jarType=savings');

      const request = page.http.expectOne(OCTOBER);
      expect(request.request.method).toBe('GET');
      request.flush(OCTOBER_PLAN_FIXTURE);
      render(page);

      expect(jarSelect(page).value).toBe('savings');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('5,000,000 VND');
    });

    it('preselects only the jar when there is no expenseDate, and keeps today as the date', async () => {
      const page = await createPage('/expenses/new?jarType=savings');
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(dateInput(page).value).toBe('2026-09-15');
      expect(jarSelect(page).value).toBe('savings');
    });

    it.each(['bogus', 'FOOD', 'Food', '', 'food ', '__proto__'])(
      'does not preselect an unknown jarType: %j',
      async (jarType) => {
        const page = await createPage(`/expenses/new?expenseDate=2026-09-01&jarType=${encodeURIComponent(jarType)}`);
        flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

        expect(jarSelect(page).value).toBe('');
        expect(jarSelect(page).disabled).toBe(false);
        expect(selectedJarName(page)).toBe(PLACEHOLDER);
        expect(alertTexts(page)).toEqual([]);
      }
    );

    it.each(['2026-02-30', '2026-13-01', '2026-9-1', 'abc', '', '2026-09-15T10:00'])(
      'falls back to today for an invalid expenseDate: %j',
      async (expenseDate) => {
        const page = await createPage(`/expenses/new?expenseDate=${encodeURIComponent(expenseDate)}&jarType=food`);

        expect(dateInput(page).value).toBe('2026-09-15');
        expect(pending(page)).toEqual([`GET ${SEPTEMBER}`]);
      }
    );

    // Previously this test asserted that a missing plan dropped the jarType; the jar is now kept until a plan is ready.
    it('does not preselect the jar while the plan of that month is missing, and applies it once a month with a plan loads', async () => {
      const page = await createPage('/expenses/new?expenseDate=2026-08-01&jarType=food');
      flushFailure(page, BY_PERIOD(2026, 8), 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);
      expectNoJars(page);
      expect(selectedJarName(page)).toBe(PLACEHOLDER);

      enterDate(page, '2026-09-01');
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(jarSelect(page).disabled).toBe(false);
      expect(jarSelect(page).value).toBe('food');
      expect(selectedJarName(page)).toBe('Food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('5,000,000 VND');
    });

    it('keeps the jarType through a missing plan and uses the budgets of the month that finally loads', async () => {
      const page = await createPage('/expenses/new?jarType=savings');
      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);
      expectMissingPlanState(page, 'September 2026');

      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(jarSelect(page).value).toBe('savings');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('5,000,000 VND');
      expect(alertTexts(page)).toEqual([]);
    });

    it('restores the jarType from the entry link when Try again succeeds after a 500', async () => {
      const page = await createPage('/expenses/new?expenseDate=2026-09-01&jarType=food');
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);
      expectNoJars(page);

      retryButton(page).click();
      render(page);
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(jarSelect(page).disabled).toBe(false);
      expect(jarSelect(page).value).toBe('food');
      expect(selectedJarName(page)).toBe('Food');
      expect(alertTexts(page)).toEqual([]);
    });

    it('restores the jarType after a network failure and after a retry that fails again', async () => {
      const page = await createPage('/expenses/new?jarType=children');
      flushNetworkError(page, SEPTEMBER);

      retryButton(page).click();
      render(page);
      flushFailure(page, SEPTEMBER, 503, 'Service Unavailable', INTERNAL_ERROR_FIXTURE);
      expectNoJars(page);

      retryButton(page).click();
      render(page);
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(jarSelect(page).value).toBe('children');
      expect(selectedJarName(page)).toBe('Children');
    });

    it('restores the jarType after a rejected 200 body once the retry returns a valid plan', async () => {
      const page = await createPage('/expenses/new?jarType=food');
      flushOk(page, { ...MONTHLY_PLAN_FIXTURE, jars: MONTHLY_PLAN_FIXTURE.jars.slice(1) }, SEPTEMBER);
      expect(alertTexts(page)[0]).toContain(INTEGRITY_FAILED);

      retryButton(page).click();
      render(page);
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(jarSelect(page).value).toBe('food');
    });

    it('does not preselect an unknown jarType after a failed load and a successful retry', async () => {
      const page = await createPage('/expenses/new?jarType=bogus');
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      retryButton(page).click();
      render(page);
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(jarSelect(page).disabled).toBe(false);
      expect(jarSelect(page).value).toBe('');
    });

    it('applies the restored jarType only once, so a later month change does not bring it back', async () => {
      const page = await createPage('/expenses/new?jarType=food');
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);
      retryButton(page).click();
      render(page);
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);
      expect(jarSelect(page).value).toBe('food');

      choose(page, '');
      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(jarSelect(page).value).toBe('');
    });

    it('applies the jarType query param only once, not again after the user picked another value and moved month', async () => {
      const page = await createPage('/expenses/new?jarType=food');
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);
      expect(jarSelect(page).value).toBe('food');

      choose(page, '');
      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(jarSelect(page).value).toBe('');
    });
  });

  describe('month changes (AC1, AC5, AC6, TC_F3_001, TC_F3_007)', () => {
    it('loads the plan of the new month with exactly one GET when the date moves to another month', async () => {
      const page = await readyPage();

      enterDate(page, '2026-10-05');

      expect(pending(page)).toEqual([`GET ${OCTOBER}`]);
    });

    it('does not reload when the date changes inside the same month', async () => {
      const page = await readyPage();
      choose(page, 'food');

      enterDate(page, '2026-09-30');
      enterDate(page, '2026-09-01');

      page.http.expectNone(SEPTEMBER);
      expect(pending(page)).toEqual([]);
      expect(loadingHint(page)).toBe('');
      expect(optionLabels(page)).toHaveLength(8);
      expect(jarSelect(page).value).toBe('food');
    });

    it('requests the same month of another year as a different month', async () => {
      const page = await readyPage();

      enterDate(page, '2027-09-15');

      expect(pending(page)).toEqual([`GET ${BY_PERIOD(2027, 9)}`]);
    });

    it('never shows the previous month jars while the new month is loading', async () => {
      const page = await readyPage();
      choose(page, 'food');
      expect(optionLabels(page)).toHaveLength(8);

      enterDate(page, '2026-10-05');

      expect(optionLabels(page)).toEqual([PLACEHOLDER]);
      expect(jarSelect(page).disabled).toBe(true);
      expect(saveButton(page).disabled).toBe(true);
      expect(loadingHint(page)).toBe(LOADING);
      expect(selectedJarName(page)).toBe(PLACEHOLDER);
      expect(pageText(page)).not.toContain('5,000,000 VND');

      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(optionLabels(page)).toHaveLength(8);
      expect(loadingHint(page)).toBe('');
      expect(jarSelect(page).disabled).toBe(false);
      expect(saveButton(page).disabled).toBe(false);
    });

    it('shows the budgets of the new plan and keeps the selected jar when the new plan has it', async () => {
      const page = await readyPage();
      choose(page, 'food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('5,000,000 VND');

      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(jarSelect(page).value).toBe('food');
      expect(selectedJarName(page)).toBe('Food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('2,000,000 VND');
      expect(pageText(page)).not.toContain('5,000,000 VND');
    });

    it('offers no jars when the new month has no plan, and keeps the choice for the next month that has one', async () => {
      const page = await readyPage();
      choose(page, 'food');

      enterDate(page, '2026-10-05');
      flushFailure(page, OCTOBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      expectMissingPlanState(page, 'October 2026');
      expect(selectedJarName(page)).toBe(PLACEHOLDER);

      enterDate(page, '2026-11-02');
      flushOk(page, NOVEMBER_PLAN, NOVEMBER);

      expect(jarSelect(page).disabled).toBe(false);
      expect(jarSelect(page).value).toBe('food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('6,000,000 VND');
      expect(alertTexts(page)).toEqual([]);
    });

    it('offers no jars when the new month fails to load, and keeps the choice after Try again', async () => {
      const page = await readyPage();
      choose(page, 'food');

      enterDate(page, '2026-10-05');
      flushFailure(page, OCTOBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      expectNoJars(page);
      expect(selectedJarName(page)).toBe(PLACEHOLDER);

      retryButton(page).click();
      render(page);
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(jarSelect(page).value).toBe('food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('2,000,000 VND');
    });

    it('recovers when the date moves from a month without a plan to a month with one', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);
      expectMissingPlanState(page, 'September 2026');

      enterDate(page, '2026-10-05');
      expect(alertTexts(page)).toEqual([]);
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(alertTexts(page)).toEqual([]);
      expect(jarSelect(page).disabled).toBe(false);
      expect(optionLabels(page)).toHaveLength(8);
    });

    it('cancels the in-flight request of the old month when the date moves again, so a stale plan never wins', async () => {
      const page = await createPage();
      const september = page.http.expectOne(SEPTEMBER);

      // The in-flight September GET is dropped as soon as the date changes, before the October GET is even sent.
      enter(page, dateInput(page), '2026-10-05');
      expect(september.cancelled).toBe(true);
      expect(pending(page)).toEqual([]);
      elapse(page);
      const october = page.http.expectOne(OCTOBER);
      expect(october.cancelled).toBe(false);

      enterDate(page, '2026-11-02');
      const november = page.http.expectOne(NOVEMBER);
      expect(october.cancelled).toBe(true);
      expect(november.cancelled).toBe(false);

      november.flush(NOVEMBER_PLAN);
      render(page);

      choose(page, 'food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('6,000,000 VND');
      expect(pageText(page)).not.toContain('5,000,000 VND');
      expect(pageText(page)).not.toContain('2,000,000 VND');
      expect(alertTexts(page)).toEqual([]);
    });

    it('ignores a late answer for the month the user already left', async () => {
      const page = await readyPage();
      enterDate(page, '2026-10-05');
      const october = page.http.expectOne(OCTOBER);

      enterDate(page, '2026-09-20');
      const septemberAgain = page.http.expectOne(SEPTEMBER);
      expect(october.cancelled).toBe(true);

      septemberAgain.flush(MONTHLY_PLAN_FIXTURE);
      render(page);

      expect(optionLabels(page)).toHaveLength(8);
      choose(page, 'food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('5,000,000 VND');
    });

    it('accepts the leap day of a leap year and loads its month (TC_F3_010)', async () => {
      const page = await readyPage();

      enterDate(page, '2024-02-29');
      flushOk(page, LEAP_PLAN, BY_PERIOD(2024, 2));
      fillValid(page);
      save(page);

      expect(postRequest(page).request.body).toEqual({ ...EXPECTED_BODY, expenseDate: '2024-02-29' });
      expect(alertTexts(page)).toEqual([]);
    });

    it('shows a date error and sends nothing for 29 February of a non-leap year', async () => {
      const page = await readyPage();

      // jsdom drops a date it cannot represent, so the control receives an empty value, like a browser date field.
      enterDate(page, '2026-02-29');
      blur(page, dateInput(page));

      expect(pending(page)).toEqual([]);
      expectLinkedError(page, dateInput(page), 'expense-date-error', DATE_ERROR);
    });

    it('rejects a 200 body that belongs to another month instead of showing its jars', async () => {
      const page = await readyPage();

      enterDate(page, '2026-10-05');
      flushOk(page, MONTHLY_PLAN_FIXTURE, OCTOBER);

      expect(alertTexts(page)[0]).toContain(INTEGRITY_FAILED);
      expectNoJars(page);
    });

    it.each(MALFORMED_PLANS)(
      'rejects a malformed 200 body (%s) with a retry message and no jars',
      async (_label, body) => {
        const page = await createPage();
        flushOk(page, body, SEPTEMBER);

        expect(alertTexts(page)[0]).toContain(INTEGRITY_FAILED);
        expect(retryButton(page).type).toBe('button');
        expectNoJars(page);
      }
    );

    it('clears a previous success message and the totals when the date moves to another month', async () => {
      const page = await savePending();
      flushCreated(page);
      expect(saveResult(page)).toContain('Expense saved');
      expect(Object.keys(jarTotals(page))).toHaveLength(3);

      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(saveResult(page)).toBe('');
      expect(jarTotals(page)).toEqual({});
    });
  });

  describe('201 that arrives after the date moved to another month (TC_F3_011, AC5)', () => {
    it('does not show the old month totals next to the jar of the new month', async () => {
      const page = await savePending();
      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('2,000,000 VND');

      // The September expense was saved; its September totals must not be presented as October's.
      flushCreated(page);

      expect(jarTotals(page)).toEqual({});
      expect(page.root.querySelector('.totals-title')).toBeNull();
      expect(pageText(page)).toContain('Jar spending totals refresh after the expense is saved.');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('2,000,000 VND');
    });

    it('still tells the user that the expense was saved', async () => {
      const page = await savePending();
      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      flushCreated(page);

      expect(saveResult(page)).toBe('Expense saved: 1,250,000 VND to Food.');
      expect(saveButton(page).disabled).toBe(false);
    });

    it('hides the old month totals when the 201 arrives while the new month is still loading, and after it loads', async () => {
      const page = await savePending();
      enterDate(page, '2026-10-05');

      flushCreated(page);

      expect(jarTotals(page)).toEqual({});
      expect(saveResult(page)).toContain('Expense saved');

      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(jarSelect(page).value).toBe('food');
      expect(jarTotals(page)).toEqual({});
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('2,000,000 VND');
    });

    it('hides the totals when the 201 arrives after the date was cleared', async () => {
      const page = await savePending();
      enter(page, dateInput(page), '');

      flushCreated(page);

      expect(jarTotals(page)).toEqual({});
      expect(saveResult(page)).toContain('Expense saved');
    });

    it('still shows the totals when the date only moved inside the same month', async () => {
      const page = await savePending();
      enterDate(page, '2026-09-20');
      page.http.expectNone(SEPTEMBER);

      flushCreated(page);

      expect(jarTotals(page)).toEqual({
        Budget: '5,000,000 VND',
        Spent: '1,250,000 VND',
        Remaining: '3,750,000 VND'
      });
    });

    it('shows totals again after the user returns to the month and saves another expense', async () => {
      const page = await savePending();
      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);
      flushCreated(page);
      expect(jarTotals(page)).toEqual({});

      enterDate(page, '2026-09-15');
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);
      expect(jarTotals(page)).toEqual({});

      // The late 201 cleared the unchanged amount and description, so they are entered again.
      fillValid(page);
      save(page);
      flushCreated(page);

      expect(jarTotals(page)).toEqual({
        Budget: '5,000,000 VND',
        Spent: '1,250,000 VND',
        Remaining: '3,750,000 VND'
      });
    });
  });

  describe('text typed while the POST is pending', () => {
    it('keeps an amount typed during the save and still clears the unchanged description', async () => {
      const page = await savePending();

      enter(page, amountInput(page), '300,000');
      flushCreated(page);

      expect(amountInput(page).value).toBe('300,000');
      expect(descriptionInput(page).value).toBe('');
      expect(saveResult(page)).toBe('Expense saved: 1,250,000 VND to Food.');
      expect(alertTexts(page)).toEqual([]);
      expectNoError(page, amountInput(page), 'expense-amount-error');
    });

    it('keeps a description typed during the save and still clears the unchanged amount', async () => {
      const page = await savePending();

      enter(page, descriptionInput(page), 'Snacks');
      flushCreated(page);

      expect(descriptionInput(page).value).toBe('Snacks');
      expect(amountInput(page).value).toBe('');
      expect(saveResult(page)).toBe('Expense saved: 1,250,000 VND to Food.');
      expect(alertTexts(page)).toEqual([]);
    });

    it('keeps both fields when both were edited during the save', async () => {
      const page = await savePending();

      enter(page, amountInput(page), '300,000');
      enter(page, descriptionInput(page), 'Snacks');
      flushCreated(page);

      expect(amountInput(page).value).toBe('300,000');
      expect(descriptionInput(page).value).toBe('Snacks');
      expect(dateInput(page).value).toBe('2026-09-15');
      expect(jarSelect(page).value).toBe('food');
    });

    it('sends the text that survived the save with the next submit', async () => {
      const page = await savePending();
      enter(page, amountInput(page), '300,000');
      flushCreated(page);

      save(page);
      expect(pending(page)).toEqual([]);
      expectLinkedError(page, descriptionInput(page), 'expense-description-error', DESCRIPTION_REQUIRED);

      enter(page, descriptionInput(page), 'Snacks');
      save(page);

      expect(postRequest(page).request.body).toStrictEqual({
        ...EXPECTED_BODY,
        amountVnd: '300000',
        description: 'Snacks'
      });
    });

    it('clears a field that was edited and ended up equal to the saved value', async () => {
      const page = await savePending();

      // Same amount without grouping and same description with padding: normalized and trimmed they equal the request.
      enter(page, amountInput(page), '1250000');
      enter(page, descriptionInput(page), '  Weekly groceries  ');
      flushCreated(page);

      expect(amountInput(page).value).toBe('');
      expect(descriptionInput(page).value).toBe('');
    });

    it('keeps a description that became blank text during the save', async () => {
      const page = await savePending();

      enter(page, descriptionInput(page), '   ');
      flushCreated(page);

      expect(descriptionInput(page).value).toBe('   ');
      expect(amountInput(page).value).toBe('');
    });

    it('keeps an amount that was edited into another value during the save, even if that value is invalid', async () => {
      const page = await savePending();

      enter(page, amountInput(page), '1,25');
      flushCreated(page);

      expect(amountInput(page).value).toBe('1,25');
      expect(descriptionInput(page).value).toBe('');
    });

    it('does not touch the typed text when the save fails', async () => {
      const page = await savePending();

      enter(page, amountInput(page), '300,000');
      enter(page, descriptionInput(page), 'Snacks');
      flushPostFailure(page, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      expect(amountInput(page).value).toBe('300,000');
      expect(descriptionInput(page).value).toBe('Snacks');
      expect(alertTexts(page)).toEqual([SAVE_FAILED]);
    });
  });

  describe('plan not found (TC_F3_007, AC5)', () => {
    it('explains that a plan is needed, links to monthly planning and shows no jars', async () => {
      const page = await createPage();

      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      expectMissingPlanState(page, 'September 2026');
      expect(alertTexts(page)[0]).not.toContain('Try again');
      expect(loadingHint(page)).toBe('');
    });

    it('does not POST when Save is pressed, and keeps the typed values', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), 'Weekly groceries');

      save(page);

      expect(pending(page)).toEqual([]);
      expect(amountInput(page).value).toBe('1,250,000');
      expect(descriptionInput(page).value).toBe('Weekly groceries');
      expect(saveResult(page)).toBe('');
    });

    it('treats a 404 without the plan-not-found code as a load failure, not as a missing plan', async () => {
      const page = await createPage();

      flushFailure(page, SEPTEMBER, 404, 'Not Found', 'Not Found');

      expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
      expect(alertTexts(page)[0]).toContain(PLAN_LOAD_FAILED);
      expect(retryButton(page).textContent).toContain('Try again');
    });
  });

  describe('plan load failures and retry (AC1)', () => {
    it('shows a generic message with Try again for a 500, never the raw server message', async () => {
      const page = await createPage();

      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      expect(alertTexts(page)).toEqual([`${PLAN_LOAD_FAILED} Try again`]);
      expect(pageText(page)).not.toContain('stack trace');
      expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
      expectNoJars(page);
      expect(pending(page)).toEqual([]);
    });

    it('shows the network message with Try again when the server cannot be reached', async () => {
      const page = await createPage();

      flushNetworkError(page, SEPTEMBER);

      expect(alertTexts(page)).toEqual([`${NETWORK_FAILED} Try again`]);
      expectNoJars(page);
    });

    it('sends nothing on its own after a failed load', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      page.http.expectNone(SEPTEMBER);
      page.http.expectNone(EXPENSES);
    });

    it('re-issues the plan GET when Try again is pressed, shows loading, and never POSTs', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      retryButton(page).click();
      render(page);

      expect(pending(page)).toEqual([`GET ${SEPTEMBER}`]);
      expect(loadingHint(page)).toBe(LOADING);
      expect(alertTexts(page)).toEqual([]);
      expect(saveButton(page).disabled).toBe(true);
    });

    it('shows the jars when the retry succeeds', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      retryButton(page).click();
      render(page);
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(alertTexts(page)).toEqual([]);
      expect(optionLabels(page)).toHaveLength(8);
      expect(jarSelect(page).disabled).toBe(false);
    });

    it('shows the error again, with a working Try again, when the retry also fails', async () => {
      const page = await createPage();
      flushNetworkError(page, SEPTEMBER);

      retryButton(page).click();
      render(page);
      flushFailure(page, SEPTEMBER, 503, 'Service Unavailable', INTERNAL_ERROR_FIXTURE);

      expect(alertTexts(page)).toEqual([`${PLAN_LOAD_FAILED} Try again`]);

      retryButton(page).click();
      render(page);
      expect(pending(page)).toEqual([`GET ${SEPTEMBER}`]);
    });

    it('turns a retry that finds no plan into the missing-plan state', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      retryButton(page).click();
      render(page);
      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      expectMissingPlanState(page, 'September 2026');
    });

    it('does not POST when Save is pressed after a failed load', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), 'Weekly groceries');

      save(page);

      expect(pending(page)).toEqual([]);
      expect(amountInput(page).value).toBe('1,250,000');
    });
  });

  describe('date cleared or invalid', () => {
    it('shows the idle hint, locks the jar and sends no request when the date is cleared', async () => {
      const page = await readyPage();
      choose(page, 'food');

      enter(page, dateInput(page), '');

      expect(text(el(page.root, '#expense-date-hint'))).toBe(IDLE_HINT);
      expect(dateInput(page).getAttribute('aria-describedby')).toBe('expense-date-hint');
      expectNoJars(page);
      expect(selectedJarName(page)).toBe(PLACEHOLDER);
      expect(loadingHint(page)).toBe('');
      expect(pending(page)).toEqual([]);
    });

    it('shows the date error with aria links once the field is left empty', async () => {
      const page = await readyPage();

      enter(page, dateInput(page), '');
      expect(alertTexts(page)).toEqual([]);
      blur(page, dateInput(page));

      expectLinkedError(page, dateInput(page), 'expense-date-error', DATE_ERROR);
      expect(alertTexts(page)).toEqual([DATE_ERROR]);
    });

    // Previously the jar was cleared when the date was emptied; its value is now kept so retyping does not lose it.
    it('loads the plan again when a valid date comes back, even for the same month, and keeps the jar', async () => {
      const page = await readyPage();
      choose(page, 'food');
      enter(page, dateInput(page), '');

      enterDate(page, '2026-09-20');

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.method).toBe('GET');
      expect(pageText(page)).not.toContain(IDLE_HINT);
      expect(jarSelect(page).disabled).toBe(true);

      request.flush(MONTHLY_PLAN_FIXTURE);
      render(page);

      expect(jarSelect(page).disabled).toBe(false);
      expect(jarSelect(page).value).toBe('food');
      expect(selectedJarName(page)).toBe('Food');
      expect(alertTexts(page)).toEqual([]);
    });

    it('keeps the jar when the date is backspaced to empty and retyped in another month', async () => {
      const page = await readyPage();
      choose(page, 'food');

      enter(page, dateInput(page), '');
      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(jarSelect(page).value).toBe('food');
      expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('2,000,000 VND');
      expect(alertTexts(page)).toEqual([]);
    });

    it('goes idle at once, without waiting for the delay, and never sends a GET for an empty date', async () => {
      const page = await readyPage();
      choose(page, 'food');

      enter(page, dateInput(page), '');

      expect(text(el(page.root, '#expense-date-hint'))).toBe(IDLE_HINT);
      expect(loadingHint(page)).toBe('');
      expect(jarSelect(page).disabled).toBe(true);
      elapse(page, PLAN_LOAD_DELAY_MS * 3);
      expect(pending(page)).toEqual([]);
    });

    it('does not POST when Save is pressed, reports the date and moves focus to it', async () => {
      const page = await readyPage();
      fillValid(page);
      enter(page, dateInput(page), '');

      save(page);

      expect(pending(page)).toEqual([]);
      expectLinkedError(page, dateInput(page), 'expense-date-error', DATE_ERROR);
      expect(statusSummary(page)).toBe(SUMMARY);
      expect(document.activeElement).toBe(dateInput(page));
      expect(amountInput(page).value).toBe('1,250,000');
    });
  });

  describe('validation (TC_F3_003, TC_F3_004, TC_F3_005, TC_F3_006, AC3, AC4)', () => {
    it('shows no error before the user interacts', async () => {
      const page = await readyPage();

      expect(alertTexts(page)).toEqual([]);
      expectNoError(page, jarSelect(page), 'expense-jar-error');
      expectNoError(page, amountInput(page), 'expense-amount-error');
      expectNoError(page, descriptionInput(page), 'expense-description-error');
      expectNoError(page, dateInput(page), 'expense-date-error');
    });

    it('rejects an empty submit with a message per field, aria links, a status summary and focus on the jar', async () => {
      const page = await readyPage();

      save(page);

      expect(pending(page)).toEqual([]);
      expect(alertTexts(page)).toEqual([JAR_ERROR, AMOUNT_ERROR, DESCRIPTION_REQUIRED]);
      expectLinkedError(page, jarSelect(page), 'expense-jar-error', JAR_ERROR);
      expectLinkedError(page, amountInput(page), 'expense-amount-error', AMOUNT_ERROR);
      expectLinkedError(page, descriptionInput(page), 'expense-description-error', DESCRIPTION_REQUIRED);
      expectNoError(page, dateInput(page), 'expense-date-error');
      expect(statusSummary(page)).toBe(SUMMARY);
      expect(document.activeElement).toBe(jarSelect(page));
    });

    it('reports every missing field at once, including the date (AC4)', async () => {
      const page = await readyPage();
      enter(page, dateInput(page), '');

      save(page);

      expect(pending(page)).toEqual([]);
      // The jar is locked while there is no date, so it has no error of its own.
      expect(alertTexts(page)).toEqual([DATE_ERROR, AMOUNT_ERROR, DESCRIPTION_REQUIRED]);
      expectLinkedError(page, dateInput(page), 'expense-date-error', DATE_ERROR);
      expectLinkedError(page, amountInput(page), 'expense-amount-error', AMOUNT_ERROR);
      expectLinkedError(page, descriptionInput(page), 'expense-description-error', DESCRIPTION_REQUIRED);
      expect(statusSummary(page)).toBe(SUMMARY);
      expect(document.activeElement).toBe(dateInput(page));
    });

    it('moves focus to the first invalid control in page order', async () => {
      const page = await readyPage();
      choose(page, 'food');

      save(page);
      expect(document.activeElement).toBe(amountInput(page));

      enter(page, amountInput(page), '1,250,000');
      save(page);
      expect(document.activeElement).toBe(descriptionInput(page));
    });

    it('updates the messages while the user fixes the fields, and clears the status summary when all are valid', async () => {
      const page = await readyPage();
      save(page);
      expect(statusSummary(page)).toBe(SUMMARY);

      choose(page, 'food');
      expect(alertTexts(page)).toEqual([AMOUNT_ERROR, DESCRIPTION_REQUIRED]);
      expectNoError(page, jarSelect(page), 'expense-jar-error');

      enter(page, amountInput(page), '1,250,000');
      expect(alertTexts(page)).toEqual([DESCRIPTION_REQUIRED]);
      expect(statusSummary(page)).toBe(SUMMARY);

      enter(page, descriptionInput(page), 'Weekly groceries');
      expect(alertTexts(page)).toEqual([]);
      expect(statusSummary(page)).toBe('');
      expect(pending(page)).toEqual([]);
    });

    it('shows a field error as soon as the field is left, without a submit', async () => {
      const page = await readyPage();

      enter(page, amountInput(page), '12.5');
      expect(alertTexts(page)).toEqual([]);
      blur(page, amountInput(page));

      expectLinkedError(page, amountInput(page), 'expense-amount-error', AMOUNT_ERROR);
      expect(statusSummary(page)).toBe('');
    });

    it.each(['0', '000', '0,000', '  0  '])(
      'rejects the zero amount %j with the greater-than-zero message',
      async (amount) => {
        const page = await readyPage();
        choose(page, 'food');
        enter(page, descriptionInput(page), 'Weekly groceries');
        enter(page, amountInput(page), amount);

        save(page);

        expect(pending(page)).toEqual([]);
        expect(alertTexts(page)).toEqual([AMOUNT_ZERO]);
        expectLinkedError(page, amountInput(page), 'expense-amount-error', AMOUNT_ZERO);
        expect(document.activeElement).toBe(amountInput(page));
        expect(amountInput(page).value).toBe(amount);
      }
    );

    it.each(['12.5', '1.5', 'abc', '1,5', '1,00', '-5', '1e3', '٣٠٠', '12 500', '', '   ', '9223372036854775808'])(
      'rejects the amount %j with the whole-VND message',
      async (amount) => {
        const page = await readyPage();
        choose(page, 'food');
        enter(page, descriptionInput(page), 'Weekly groceries');
        enter(page, amountInput(page), amount);

        save(page);

        expect(pending(page)).toEqual([]);
        expect(alertTexts(page)).toEqual([AMOUNT_ERROR]);
        expectLinkedError(page, amountInput(page), 'expense-amount-error', AMOUNT_ERROR);
        expect(document.activeElement).toBe(amountInput(page));
        expect(amountInput(page).value).toBe(amount);
      }
    );

    it('accepts the smallest positive whole-VND amount and sends it as the string "1" (TC_F3_003)', async () => {
      const page = await readyPage();
      fillValid(page, '1');

      expectNoError(page, amountInput(page), 'expense-amount-error');
      save(page);

      expect(postRequest(page).request.body).toEqual({ ...EXPECTED_BODY, amountVnd: '1' });
    });

    it.each<[string, string]>([
      ['25000000', '25000000'],
      ['1,250,000', '1250000'],
      ['  1,250,000  ', '1250000'],
      ['9223372036854775807', '9223372036854775807']
    ])('accepts the amount %j and sends the digits %j', async (amount, digits) => {
      const page = await readyPage();
      fillValid(page, amount);

      save(page);

      expect(postRequest(page).request.body).toStrictEqual({ ...EXPECTED_BODY, amountVnd: digits });
    });

    it.each(['', ' ', '     ', '\t', ' \t '])('rejects the blank description %j as required', async (description) => {
      const page = await readyPage();
      choose(page, 'food');
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), description);

      save(page);

      expect(pending(page)).toEqual([]);
      expect(alertTexts(page)).toEqual([DESCRIPTION_REQUIRED]);
      expectLinkedError(page, descriptionInput(page), 'expense-description-error', DESCRIPTION_REQUIRED);
      expect(document.activeElement).toBe(descriptionInput(page));
    });

    it('rejects a description of 501 characters with the too-long message and keeps the text', async () => {
      const page = await readyPage();
      const description = 'a'.repeat(501);
      choose(page, 'food');
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), description);

      save(page);

      expect(pending(page)).toEqual([]);
      expectLinkedError(page, descriptionInput(page), 'expense-description-error', DESCRIPTION_TOO_LONG);
      expect(descriptionInput(page).value).toBe(description);
    });

    it('accepts a description of exactly 500 characters', async () => {
      const page = await readyPage();
      const description = 'a'.repeat(500);
      fillValid(page, '1,250,000', description);

      save(page);

      expect(alertTexts(page)).toEqual([]);
      expect(postRequest(page).request.body).toEqual({ ...EXPECTED_BODY, description });
    });

    it('counts the trimmed description: 500 characters plus padding spaces are sent trimmed', async () => {
      const page = await readyPage();
      const description = 'a'.repeat(500);
      fillValid(page, '1,250,000', `   ${description}   `);

      save(page);

      expect(alertTexts(page)).toEqual([]);
      expect(postRequest(page).request.body).toEqual({ ...EXPECTED_BODY, description });
    });

    it('requires a jar even when everything else is valid', async () => {
      const page = await readyPage();
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), 'Weekly groceries');

      save(page);

      expect(pending(page)).toEqual([]);
      expect(alertTexts(page)).toEqual([JAR_ERROR]);
      expect(document.activeElement).toBe(jarSelect(page));
    });

    it('requires a jar again after the user goes back to the placeholder option', async () => {
      const page = await readyPage();
      fillValid(page);
      choose(page, '');

      save(page);

      expect(pending(page)).toEqual([]);
      expectLinkedError(page, jarSelect(page), 'expense-jar-error', JAR_ERROR);
    });
  });

  describe('submit success (TC_F3_002, TC_F3_011, AC2)', () => {
    it('POSTs exactly the request body: date, jar, amount as a digit string, trimmed description', async () => {
      const page = await readyPage();
      choose(page, 'food');
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), '   Weekly groceries   ');

      save(page);

      const request = postRequest(page);
      expect(request.request.url).toBe(EXPENSES);
      // `toStrictEqual` also proves there is no year, month or other extra key, and that the amount is a string.
      expect(request.request.body).toStrictEqual(EXPECTED_BODY);
      expect(pending(page)).toEqual([]);

      request.flush(CREATE_EXPENSE_RESPONSE_FIXTURE, { status: 201, statusText: 'Created' });
    });

    it('sends the date the user picked and the jar of that month', async () => {
      const page = await readyPage();
      enterDate(page, '2026-10-05');
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);
      choose(page, 'savings');
      enter(page, amountInput(page), '30,000');
      enter(page, descriptionInput(page), 'Deposit');

      save(page);

      expect(postRequest(page).request.body).toEqual({
        expenseDate: '2026-10-05',
        jarType: 'savings',
        amountVnd: '30000',
        description: 'Deposit'
      });
    });

    it('announces the saved expense in the polite status region', async () => {
      const page = await savePending();

      expect(saveResult(page)).toBe('');

      flushCreated(page);

      expect(saveResult(page)).toBe('Expense saved: 1,250,000 VND to Food.');
      expect(el(page.root, '.save-result').getAttribute('role')).toBe('status');
    });

    it('shows the backend budget, spent and remaining of the jar, formatted as VND', async () => {
      const page = await savePending();

      flushCreated(page);

      expect(jarTotals(page)).toEqual({
        Budget: '5,000,000 VND',
        Spent: '1,250,000 VND',
        Remaining: '3,750,000 VND'
      });
      expect(pageText(page)).not.toContain('Over budget');
      expect(pageText(page)).not.toContain('Jar spending totals refresh after the expense is saved.');
    });

    it('shows the totals exactly as the backend returned them, not recomputed', async () => {
      const page = await savePending();

      flushCreated(page, {
        ...CREATE_EXPENSE_RESPONSE_FIXTURE,
        jarSummary: {
          ...CREATE_EXPENSE_RESPONSE_FIXTURE.jarSummary,
          budgetVnd: '5000000',
          spentVnd: '2000000',
          remainingVnd: '1234567'
        }
      });

      expect(jarTotals(page)).toEqual({
        Budget: '5,000,000 VND',
        Spent: '2,000,000 VND',
        Remaining: '1,234,567 VND'
      });
    });

    it('shows a negative remaining and the text "Over budget" when the jar is overspent', async () => {
      const page = await savePending();

      flushCreated(page, OVER_BUDGET_EXPENSE_RESPONSE_FIXTURE);

      expect(jarTotals(page)).toEqual({
        Budget: '5,000,000 VND',
        Spent: '5,500,000 VND',
        Remaining: '-500,000 VND Over budget'
      });
      expect(text(el(page.root, '.over-label'))).toBe('Over budget');
    });

    it('does not say "Over budget" when the remaining is exactly zero', async () => {
      const page = await savePending();

      flushCreated(page, {
        ...CREATE_EXPENSE_RESPONSE_FIXTURE,
        jarSummary: { ...CREATE_EXPENSE_RESPONSE_FIXTURE.jarSummary, spentVnd: '5000000', remainingVnd: '0' }
      });

      expect(jarTotals(page)['Remaining']).toBe('0 VND');
      expect(pageText(page)).not.toContain('Over budget');
    });

    it('clears the amount and the description and keeps the date and the jar', async () => {
      const page = await savePending();

      flushCreated(page);

      expect(amountInput(page).value).toBe('');
      expect(descriptionInput(page).value).toBe('');
      expect(dateInput(page).value).toBe('2026-09-15');
      expect(jarSelect(page).value).toBe('food');
      expect(selectedJarName(page)).toBe('Food');
    });

    it('shows no validation error for the fields it just cleared', async () => {
      const page = await savePending();

      flushCreated(page);

      expect(alertTexts(page)).toEqual([]);
      expect(statusSummary(page)).toBe('');
      expectNoError(page, amountInput(page), 'expense-amount-error');
      expectNoError(page, descriptionInput(page), 'expense-description-error');
    });

    it('releases Save after the response, with the idle label and aria-busy false', async () => {
      const page = await savePending();

      flushCreated(page);

      expect(saveButton(page).disabled).toBe(false);
      expect(saveButton(page).getAttribute('aria-busy')).toBe('false');
      expect(text(saveButton(page))).toBe('Save expense');
    });

    it('hides the totals when another jar is selected after the save', async () => {
      const page = await savePending();
      flushCreated(page);
      expect(Object.keys(jarTotals(page))).toHaveLength(3);

      choose(page, 'children');

      expect(jarTotals(page)).toEqual({});
      expect(page.root.querySelector('.totals-title')).toBeNull();
      expect(pageText(page)).toContain('Jar spending totals refresh after the expense is saved.');
      expect(selectedJarName(page)).toBe('Children');
    });

    it('allows a second expense, clears the previous result while it is saving, and shows the new totals', async () => {
      const page = await savePending();
      flushCreated(page);

      enter(page, amountInput(page), '500,000');
      enter(page, descriptionInput(page), 'Snacks');
      save(page);

      expect(saveResult(page)).toBe('');
      expect(jarTotals(page)).toEqual({});
      expect(postRequest(page).request.body).toEqual({
        ...EXPECTED_BODY,
        amountVnd: '500000',
        description: 'Snacks'
      });
    });

    it('sends no GET after a save, because the totals come from the 201 body', async () => {
      const page = await savePending();

      flushCreated(page);

      expect(pending(page)).toEqual([]);
    });
  });

  describe('double submit', () => {
    it('sends one POST while saving, disables Save, marks it busy and ignores a second submit', async () => {
      const page = await savePending();

      expect(saveButton(page).disabled).toBe(true);
      expect(saveButton(page).getAttribute('aria-busy')).toBe('true');
      expect(text(saveButton(page))).toBe('Saving…');
      expect(statusSummary(page)).toBe(SAVING);

      submitForm(page);
      submitForm(page);
      saveButton(page).click();
      render(page);

      const requests = page.http.match(() => true);
      expect(requests).toHaveLength(1);
      expect(requests[0].request.method).toBe('POST');
      expect(requests[0].request.url).toBe(EXPENSES);

      requests[0].flush(CREATE_EXPENSE_RESPONSE_FIXTURE, { status: 201, statusText: 'Created' });
    });

    it('does not change the form values or show errors for the ignored second submit', async () => {
      const page = await savePending();

      submitForm(page);

      expect(amountInput(page).value).toBe('1,250,000');
      expect(descriptionInput(page).value).toBe('Weekly groceries');
      expect(alertTexts(page)).toEqual([]);

      flushCreated(page);
    });

    it('releases the guard after success, so the next expense can be saved', async () => {
      const page = await savePending();
      flushCreated(page);

      fillValid(page, '2,000', 'Coffee');
      save(page);

      expect(postRequest(page).request.body).toEqual({ ...EXPECTED_BODY, amountVnd: '2000', description: 'Coffee' });
    });

    it('releases the guard after a server error (finalize) and allows a user-initiated new submit', async () => {
      const page = await savePending();

      flushPostFailure(page, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      expect(saveButton(page).disabled).toBe(false);
      expect(saveButton(page).getAttribute('aria-busy')).toBe('false');
      expect(text(saveButton(page))).toBe('Save expense');
      expect(pending(page)).toEqual([]);

      save(page);

      expect(postRequest(page).request.body).toEqual(EXPECTED_BODY);
    });

    it('releases the guard after a network error', async () => {
      const page = await savePending();

      postRequest(page).error(new ProgressEvent('error'));
      render(page);

      expect(saveButton(page).disabled).toBe(false);
      expect(saveButton(page).getAttribute('aria-busy')).toBe('false');
      expect(statusSummary(page)).toBe('');
    });

    it('releases the guard after a validation error', async () => {
      const page = await savePending();

      flushPostFailure(page, 400, 'Bad Request', EXPENSE_VALIDATION_ERROR_FIXTURE);

      expect(saveButton(page).disabled).toBe(false);
      expect(saveButton(page).getAttribute('aria-busy')).toBe('false');
    });
  });

  describe('plan load delay while the date is typed', () => {
    const step = Math.floor(PLAN_LOAD_DELAY_MS / 3);

    /** What the user sees from the moment the month changes until its plan has loaded. */
    const expectLoadingState = (page: Page): void => {
      expect(loadingHint(page)).toBe(LOADING);
      expect(optionLabels(page)).toEqual([PLACEHOLDER]);
      expect(jarSelect(page).disabled).toBe(true);
      expect(saveButton(page).disabled).toBe(true);
      expect(selectedJarName(page)).toBe(PLACEHOLDER);
      expect(alertTexts(page)).toEqual([]);
      expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
      expect(pageText(page)).not.toContain('5,000,000 VND');
    };

    it('sends the first GET at once, without waiting for the delay', async () => {
      const page = await createPage();

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.method).toBe('GET');

      request.flush(MONTHLY_PLAN_FIXTURE);
    });

    it('sends exactly one GET, for the final month, only after the delay, for a burst of date changes', async () => {
      const page = await readyPage();
      choose(page, 'food');

      for (const intermediate of ['0002-09-01', '0020-09-01', '0202-09-01']) {
        enter(page, dateInput(page), intermediate);
        expect(dateInput(page).value).toBe(intermediate);
        elapse(page, step);
        expect(pending(page)).toEqual([]);
      }
      enter(page, dateInput(page), '2026-10-01');
      expect(pending(page)).toEqual([]);

      elapse(page, PLAN_LOAD_DELAY_MS - 1);
      expect(pending(page)).toEqual([]);
      elapse(page, 1);

      const requests = page.http.match(() => true);
      expect(requests.map((request) => `${request.request.method} ${request.request.url}`)).toEqual([`GET ${OCTOBER}`]);
      requests[0].flush(OCTOBER_PLAN_FIXTURE);
      render(page);

      expect(optionLabels(page)).toHaveLength(8);
      expect(jarSelect(page).value).toBe('food');
      expect(alertTexts(page)).toEqual([]);
      expect(pending(page)).toEqual([]);
    });

    it('sends nothing further while the final date stays unchanged', async () => {
      const page = await readyPage();
      enterDate(page, '2026-10-01');
      const request = page.http.expectOne(OCTOBER);

      elapse(page, PLAN_LOAD_DELAY_MS * 5);

      expect(pending(page)).toEqual([]);
      request.flush(OCTOBER_PLAN_FIXTURE);
    });

    it('shows loading at once and keeps the jar and Save locked during the delay, with no flash of "no plan"', async () => {
      const page = await readyPage();
      choose(page, 'food');

      for (const intermediate of ['0002-09-01', '0020-09-01', '0202-09-01', '2026-10-01']) {
        enter(page, dateInput(page), intermediate);

        expectLoadingState(page);
        expect(pending(page)).toEqual([]);
        elapse(page, step);
        expectLoadingState(page);
      }

      elapse(page, PLAN_LOAD_DELAY_MS);
      expectLoadingState(page);

      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(loadingHint(page)).toBe('');
      expect(optionLabels(page)).toHaveLength(8);
    });

    it('does not submit while the delay is running', async () => {
      const page = await savePending();
      flushCreated(page);
      enter(page, dateInput(page), '2026-10-05');
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), 'Weekly groceries');

      submitForm(page);
      saveButton(page).click();
      render(page);

      expect(pending(page)).toEqual([]);
      expect(alertTexts(page)).toEqual([]);
    });

    it('still loads the month when the date comes back to the loaded month before the delay ends', async () => {
      const page = await readyPage();
      choose(page, 'food');

      enter(page, dateInput(page), '2026-10-05');
      elapse(page, step);
      enter(page, dateInput(page), '2026-09-20');
      expectLoadingState(page);
      elapse(page, PLAN_LOAD_DELAY_MS - 1);
      expect(pending(page)).toEqual([]);
      elapse(page, 1);

      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(optionLabels(page)).toHaveLength(8);
      expect(jarSelect(page).value).toBe('food');
      expect(loadingHint(page)).toBe('');
    });

    it('restarts the delay for every new month, so the earlier timer can not send its request', async () => {
      const page = await readyPage();

      enter(page, dateInput(page), '2026-10-05');
      elapse(page, PLAN_LOAD_DELAY_MS - 1);
      enter(page, dateInput(page), '2026-11-02');
      elapse(page, 1);
      expect(pending(page)).toEqual([]);
      elapse(page, PLAN_LOAD_DELAY_MS - 1);

      const requests = page.http.match(() => true);
      expect(requests.map((request) => request.request.url)).toEqual([NOVEMBER]);
      requests[0].flush(NOVEMBER_PLAN);
    });

    it('goes idle at once when the date is cleared during the delay, and the delayed request is never sent', async () => {
      const page = await readyPage();
      enter(page, dateInput(page), '2026-10-05');

      enter(page, dateInput(page), '');
      elapse(page, PLAN_LOAD_DELAY_MS * 3);

      expect(text(el(page.root, '#expense-date-hint'))).toBe(IDLE_HINT);
      expect(loadingHint(page)).toBe('');
      expect(pending(page)).toEqual([]);
    });

    it('does not delay Try again', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      retryButton(page).click();
      render(page);

      expect(pending(page)).toEqual([`GET ${SEPTEMBER}`]);
    });

    it('does not delay Try again after a date change either', async () => {
      const page = await readyPage();
      enterDate(page, '2026-10-05');
      flushFailure(page, OCTOBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      retryButton(page).click();
      render(page);

      expect(pending(page)).toEqual([`GET ${OCTOBER}`]);
    });

    it('lets a retry cancel a date change that is still waiting for its delay, without a second request', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);
      enter(page, dateInput(page), '2026-10-05');
      expect(pending(page)).toEqual([]);

      // The Try again button is gone while loading, so the page method behind it is called directly.
      page.component.retryPlan();
      render(page);

      const retry = page.http.expectOne(OCTOBER);
      expect(retry.request.method).toBe('GET');
      elapse(page, PLAN_LOAD_DELAY_MS * 2);
      expect(pending(page)).toEqual([]);

      retry.flush(OCTOBER_PLAN_FIXTURE);
      render(page);
      expect(optionLabels(page)).toHaveLength(8);
    });
  });

  describe('Save pressed while no jars are loaded', () => {
    it.each<[string, number, string, Body]>([
      ['the plan is missing', 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE],
      ['the plan failed to load', 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE]
    ])(
      'says in the status region that the expense cannot be saved yet when %s, and sends no POST',
      async (_label, status, statusText, body) => {
        const page = await createPage();
        flushFailure(page, SEPTEMBER, status, statusText, body);
        enter(page, amountInput(page), '1,250,000');
        enter(page, descriptionInput(page), 'Weekly groceries');
        expect(statusSummary(page)).toBe('');

        save(page);

        expect(statusSummary(page)).toBe(PLAN_UNAVAILABLE_MESSAGE);
        expect(el(page.root, '.status-message').getAttribute('role')).toBe('status');
        expect(el(page.root, '.status-message').getAttribute('aria-live')).toBe('polite');
        expect(pending(page)).toEqual([]);
        expect(alertTexts(page)).toHaveLength(1);
        expect(amountInput(page).value).toBe('1,250,000');
        expect(descriptionInput(page).value).toBe('Weekly groceries');
      }
    );

    it('keeps the invalid-form summary first when other fields are invalid too', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      save(page);

      expect(statusSummary(page)).toBe(SUMMARY);
      expect(pending(page)).toEqual([]);
    });

    it('shows no plan message before Save was pressed', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), 'Weekly groceries');

      expect(statusSummary(page)).toBe('');
    });

    it('clears the plan message when the jars load again and the form is complete', async () => {
      const page = await createPage('/expenses/new?jarType=food');
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);
      enter(page, amountInput(page), '1,250,000');
      enter(page, descriptionInput(page), 'Weekly groceries');
      save(page);
      expect(statusSummary(page)).toBe(PLAN_UNAVAILABLE_MESSAGE);

      retryButton(page).click();
      render(page);
      expect(statusSummary(page)).toBe('');
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(jarSelect(page).value).toBe('food');
      expect(statusSummary(page)).toBe('');
      expect(alertTexts(page)).toEqual([]);
    });

    it('says the same after a POST 404 turned the page into the missing-plan state', async () => {
      const page = await savePending();

      flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      expect(statusSummary(page)).toBe(PLAN_UNAVAILABLE_MESSAGE);
    });
  });

  describe('jar select aria-describedby', () => {
    const planAlert = (page: Page): HTMLElement => el(page.root, '#expense-plan-alert');

    it('is absent while the jars are ready and the jar has no error', async () => {
      const page = await readyPage();

      expect(jarSelect(page).hasAttribute('aria-describedby')).toBe(false);
      expect(page.root.querySelector('#expense-plan-alert')).toBeNull();
    });

    it('is absent while the plan is loading', async () => {
      const page = await createPage();

      expect(jarSelect(page).hasAttribute('aria-describedby')).toBe(false);

      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);
    });

    it('is absent while the date is empty and the form is idle', async () => {
      const page = await readyPage();

      enter(page, dateInput(page), '');

      expect(jarSelect(page).hasAttribute('aria-describedby')).toBe(false);
    });

    it('points at the missing-plan alert while the plan is missing', async () => {
      const page = await createPage();

      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      expect(jarSelect(page).getAttribute('aria-describedby')).toBe('expense-plan-alert');
      expect(els(page.root, '#expense-plan-alert')).toHaveLength(1);
      expect(planAlert(page).getAttribute('role')).toBe('alert');
      expect(text(planAlert(page))).toContain(NOT_FOUND_TITLE);
      expect(jarSelect(page).hasAttribute('aria-invalid')).toBe(false);
    });

    it('points at the load-failed alert while the plan failed to load', async () => {
      const page = await createPage();

      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

      expect(jarSelect(page).getAttribute('aria-describedby')).toBe('expense-plan-alert');
      expect(els(page.root, '#expense-plan-alert')).toHaveLength(1);
      expect(planAlert(page).getAttribute('role')).toBe('alert');
      expect(text(planAlert(page))).toContain(PLAN_LOAD_FAILED);
      expect(jarSelect(page).hasAttribute('aria-invalid')).toBe(false);
    });

    it('points at the load-failed alert for a network failure and a rejected 200 body', async () => {
      const page = await createPage();
      flushNetworkError(page, SEPTEMBER);
      expect(jarSelect(page).getAttribute('aria-describedby')).toBe('expense-plan-alert');
      expect(text(planAlert(page))).toContain(NETWORK_FAILED);

      retryButton(page).click();
      render(page);
      flushOk(page, { ...MONTHLY_PLAN_FIXTURE, jars: [] }, SEPTEMBER);

      expect(jarSelect(page).getAttribute('aria-describedby')).toBe('expense-plan-alert');
      expect(text(planAlert(page))).toContain(INTEGRITY_FAILED);
    });

    it('points at the missing-plan alert after a POST 404', async () => {
      const page = await savePending();

      flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      expect(jarSelect(page).getAttribute('aria-describedby')).toBe('expense-plan-alert');
      expect(text(planAlert(page))).toContain(NOT_FOUND_TITLE);
    });

    it('drops the reference when the alert goes away because the jars loaded', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);
      expect(jarSelect(page).getAttribute('aria-describedby')).toBe('expense-plan-alert');

      retryButton(page).click();
      render(page);
      expect(jarSelect(page).hasAttribute('aria-describedby')).toBe(false);
      flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

      expect(jarSelect(page).hasAttribute('aria-describedby')).toBe(false);
      expect(page.root.querySelector('#expense-plan-alert')).toBeNull();
    });

    it('drops the reference when the date moves to a month with a plan', async () => {
      const page = await createPage();
      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      enter(page, dateInput(page), '2026-10-05');
      expect(jarSelect(page).hasAttribute('aria-describedby')).toBe(false);
      elapse(page);
      flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

      expect(jarSelect(page).hasAttribute('aria-describedby')).toBe(false);
    });

    it('points at the jar error when the jar is invalid', async () => {
      const page = await readyPage();

      save(page);

      expect(jarSelect(page).getAttribute('aria-describedby')).toBe('expense-jar-error');
    });

    it('prefers the jar error over the plan alert when both are shown', async () => {
      const page = await savePending();
      flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

      flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      expect(jarSelect(page).getAttribute('aria-describedby')).toBe('expense-jar-error');
      expect(text(el(page.root, '#expense-jar-error'))).toBe(JAR_NOT_IN_PLAN_ERROR_FIXTURE.message);
      expect(text(planAlert(page))).toContain(NOT_FOUND_TITLE);
    });
  });

  describe('a failure that arrives after the date moved to another month', () => {
    const failures: [string, number, string, Body][] = [
      ['400 JAR_NOT_IN_MONTHLY_PLAN', 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE],
      ['400 VALIDATION_ERROR', 400, 'Bad Request', EXPENSE_VALIDATION_ERROR_FIXTURE],
      ['404 MONTHLY_PLAN_NOT_FOUND', 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE],
      ['500', 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE]
    ];

    /** Where the new month is when the old month's POST fails, and how the test finishes that month's load. */
    const states: [string, (page: Page) => void, (page: Page) => void][] = [
      [
        'is still waiting for the delay',
        (page) => enter(page, dateInput(page), '2026-10-05'),
        (page) => {
          elapse(page);
          flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);
        }
      ],
      ['is loading', (page) => enterDate(page, '2026-10-05'), (page) => flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER)],
      [
        'has loaded',
        (page) => {
          enterDate(page, '2026-10-05');
          flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);
        },
        () => undefined
      ]
    ];

    for (const [failureLabel, status, statusText, body] of failures) {
      for (const [stateLabel, moveDate, finish] of states) {
        it(`shows only the generic message for a ${failureLabel} when the new month ${stateLabel}`, async () => {
          const page = await savePending();
          moveDate(page);

          flushPostFailure(page, status, statusText, body);

          expect(alertTexts(page)).toEqual([SAVE_FAILED]);
          expectNoError(page, amountInput(page), 'expense-amount-error');
          expectNoError(page, descriptionInput(page), 'expense-description-error');
          expectNoError(page, jarSelect(page), 'expense-jar-error');
          expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
          expect(amountInput(page).value).toBe('1,250,000');
          expect(descriptionInput(page).value).toBe('Weekly groceries');
          // No reload of the old month, whatever the error code was.
          page.http.expectNone(SEPTEMBER);

          finish(page);
          expect(optionLabels(page)).toHaveLength(8);
        });
      }
    }

    it('shows only the generic message, and no reload, for a late JAR_NOT_IN_MONTHLY_PLAN after the date was cleared', async () => {
      const page = await savePending();
      enter(page, dateInput(page), '');

      flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

      expect(alertTexts(page)).toEqual([DATE_ERROR, SAVE_FAILED]);
      expect(pageText(page)).not.toContain(JAR_NOT_IN_PLAN_ERROR_FIXTURE.message);
      expect(pending(page)).toEqual([]);
    });

    it('still maps field errors when the date only moved inside the same month', async () => {
      const page = await savePending();
      enterDate(page, '2026-09-20');

      flushPostFailure(page, 400, 'Bad Request', EXPENSE_VALIDATION_ERROR_FIXTURE);

      expect(alertTexts(page)).toEqual([AMOUNT_ZERO, DESCRIPTION_TOO_LONG]);
      expect(pending(page)).toEqual([]);
    });

    it('still shows the jar error and reloads once when the date only moved inside the same month', async () => {
      const page = await savePending();
      enterDate(page, '2026-09-20');

      flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

      expectLinkedError(page, jarSelect(page), 'expense-jar-error', JAR_NOT_IN_PLAN_ERROR_FIXTURE.message);
      expect(pending(page)).toEqual([`GET ${SEPTEMBER}`]);
    });

    it('still shows the missing-plan state when the date only moved inside the same month', async () => {
      const page = await savePending();
      enterDate(page, '2026-09-20');

      flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

      expectMissingPlanState(page, 'September 2026');
    });
  });

  describe('POST errors keep the values and never retry', () => {
    const expectValuesKept = (page: Page): void => {
      expect(dateInput(page).value).toBe('2026-09-15');
      expect(jarSelect(page).value).toBe('food');
      expect(amountInput(page).value).toBe('1,250,000');
      expect(descriptionInput(page).value).toBe('Weekly groceries');
    };

    describe('400 VALIDATION_ERROR (TC_F3_004)', () => {
      it('shows each server message under its control with aria links and keeps the values', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', EXPENSE_VALIDATION_ERROR_FIXTURE);

        expect(alertTexts(page)).toEqual([AMOUNT_ZERO, DESCRIPTION_TOO_LONG]);
        expectLinkedError(page, amountInput(page), 'expense-amount-error', AMOUNT_ZERO);
        expectLinkedError(page, descriptionInput(page), 'expense-description-error', DESCRIPTION_TOO_LONG);
        expectNoError(page, jarSelect(page), 'expense-jar-error');
        expectNoError(page, dateInput(page), 'expense-date-error');
        expectValuesKept(page);
        expect(saveResult(page)).toBe('');
        expect(jarTotals(page)).toEqual({});
      });

      it('moves focus to the first field with a server error', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', EXPENSE_VALIDATION_ERROR_FIXTURE);

        expect(document.activeElement).toBe(amountInput(page));
      });

      it('clears a server error when that control is edited and keeps the others', async () => {
        const page = await savePending();
        flushPostFailure(page, 400, 'Bad Request', EXPENSE_VALIDATION_ERROR_FIXTURE);

        enter(page, amountInput(page), '1,250,001');

        expectNoError(page, amountInput(page), 'expense-amount-error');
        expectLinkedError(page, descriptionInput(page), 'expense-description-error', DESCRIPTION_TOO_LONG);
        expect(alertTexts(page)).toEqual([DESCRIPTION_TOO_LONG]);

        enter(page, descriptionInput(page), 'Weekly groceries!');

        expect(alertTexts(page)).toEqual([]);
      });

      it('maps every known field, keeps the first message per field and ignores unknown fields', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', ALL_FIELDS_ERROR);

        expect(alertTexts(page)).toEqual([
          'Server: date is invalid.',
          'Server: jar is invalid.',
          'Server: amount first.',
          'Server: description is required.'
        ]);
        expectLinkedError(page, dateInput(page), 'expense-date-error', 'Server: date is invalid.');
        expectLinkedError(page, jarSelect(page), 'expense-jar-error', 'Server: jar is invalid.');
        expectLinkedError(page, amountInput(page), 'expense-amount-error', 'Server: amount first.');
        expectLinkedError(
          page,
          descriptionInput(page),
          'expense-description-error',
          'Server: description is required.'
        );
        expect(pageText(page)).not.toContain('Server: amount second.');
        expect(pageText(page)).not.toContain('Server: not a control.');
        expect(document.activeElement).toBe(dateInput(page));
        expectValuesKept(page);
      });

      it('shows a form-level alert with the envelope message when no error maps to a control', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', UNKNOWN_FIELD_ERROR);

        expect(alertTexts(page)).toEqual([UNKNOWN_FIELD_ERROR.message]);
        expect(pageText(page)).not.toContain('Year is out of range.');
        expectNoError(page, amountInput(page), 'expense-amount-error');
        expectNoError(page, descriptionInput(page), 'expense-description-error');
        expectValuesKept(page);
      });

      it('shows a form-level alert for a 400 without field errors', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', {
          code: 'VALIDATION_ERROR',
          message: 'Nothing to save.',
          errors: []
        });

        expect(alertTexts(page)).toEqual(['Nothing to save.']);
        expectValuesKept(page);
      });

      it('shows the generic validation message for a 400 that is not an error envelope', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', 'plain text body');

        expect(alertTexts(page)).toEqual(['Some of the values are not valid. Please review the form.']);
        expect(pageText(page)).not.toContain('plain text body');
        expectValuesKept(page);
      });

      it('clears the form-level alert on the next submit', async () => {
        const page = await savePending();
        flushPostFailure(page, 400, 'Bad Request', UNKNOWN_FIELD_ERROR);

        save(page);

        expect(alertTexts(page)).toEqual([]);
        flushCreated(page);
      });

      it('never retries on its own', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', EXPENSE_VALIDATION_ERROR_FIXTURE);

        page.http.expectNone(EXPENSES);
        expect(pending(page)).toEqual([]);
      });
    });

    describe('400 JAR_NOT_IN_MONTHLY_PLAN (TC_F3_008)', () => {
      it('shows the jar error with aria links and keeps the other values', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

        expectLinkedError(page, jarSelect(page), 'expense-jar-error', JAR_NOT_IN_PLAN_ERROR_FIXTURE.message);
        expect(amountInput(page).value).toBe('1,250,000');
        expect(descriptionInput(page).value).toBe('Weekly groceries');
        expect(dateInput(page).value).toBe('2026-09-15');
        expect(saveResult(page)).toBe('');

        flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);
      });

      it('reloads the plan once, with a GET, and sends no second POST', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

        expect(pending(page)).toEqual([`GET ${SEPTEMBER}`]);
      });

      it('locks the jar while the plan reloads and offers the reloaded jars afterwards', async () => {
        const page = await savePending();
        flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

        expect(optionLabels(page)).toEqual([PLACEHOLDER]);
        expect(jarSelect(page).disabled).toBe(true);
        expect(loadingHint(page)).toBe(LOADING);
        expect(saveButton(page).disabled).toBe(true);

        flushOk(page, NON_CANONICAL_MONTHLY_PLAN_FIXTURE, SEPTEMBER);

        expect(optionValues(page)).toEqual(['', ...NON_CANONICAL_MONTHLY_PLAN_FIXTURE.jars.map((jar) => jar.jarType)]);
        expect(jarSelect(page).disabled).toBe(false);
        expect(amountInput(page).value).toBe('1,250,000');
        expect(descriptionInput(page).value).toBe('Weekly groceries');
      });

      it('offers no jars when the reload shows that the month has no plan any more, and keeps the other values', async () => {
        const page = await savePending();
        flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

        flushFailure(page, SEPTEMBER, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

        expect(pageText(page)).toContain(NOT_FOUND_TITLE);
        expectNoJars(page);
        expect(amountInput(page).value).toBe('1,250,000');
        expect(descriptionInput(page).value).toBe('Weekly groceries');
        expect(pending(page)).toEqual([]);
      });

      it('offers no jars when the reload fails and Try again, then keeps the jar once the reload works', async () => {
        const page = await savePending();
        flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

        flushFailure(page, SEPTEMBER, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

        expectNoJars(page);
        expect(retryButton(page).textContent).toContain('Try again');
        expect(pending(page)).toEqual([]);

        retryButton(page).click();
        render(page);
        flushOk(page, MONTHLY_PLAN_FIXTURE, SEPTEMBER);

        expect(jarSelect(page).value).toBe('food');
      });

      it('does not delay the reload: the GET is sent at once and needs no timer', async () => {
        const page = await savePending();

        flushPostFailure(page, 400, 'Bad Request', JAR_NOT_IN_PLAN_ERROR_FIXTURE);

        expect(page.http.expectOne(SEPTEMBER).request.method).toBe('GET');
      });
    });

    describe('404 MONTHLY_PLAN_NOT_FOUND', () => {
      it('switches to the missing-plan state, removes the jar options and keeps date, amount and description', async () => {
        const page = await savePending();

        flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

        expectMissingPlanState(page, 'September 2026');
        expect(dateInput(page).value).toBe('2026-09-15');
        expect(amountInput(page).value).toBe('1,250,000');
        expect(descriptionInput(page).value).toBe('Weekly groceries');
        expect(pageText(page)).not.toContain(SAVE_FAILED);
        expect(saveResult(page)).toBe('');
      });

      it('keeps the jar value, so it is selected again when a month with a plan loads', async () => {
        const page = await savePending();
        flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);
        expect(jarSelect(page).value).toBe('');

        enterDate(page, '2026-10-05');
        flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

        expect(jarSelect(page).value).toBe('food');
      });

      it('sends no request afterwards and does not POST on another Save', async () => {
        const page = await savePending();
        flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);
        page.http.expectNone(EXPENSES);
        page.http.expectNone(SEPTEMBER);

        save(page);

        expect(pending(page)).toEqual([]);
        expect(saveButton(page).disabled).toBe(false);
      });

      it('releases the save guard', async () => {
        const page = await savePending();

        flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

        expect(saveButton(page).disabled).toBe(false);
        expect(saveButton(page).getAttribute('aria-busy')).toBe('false');
      });

      it('recovers when the user moves the date to a month that has a plan', async () => {
        const page = await savePending();
        flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

        enterDate(page, '2026-10-05');
        flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

        expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
        expect(jarSelect(page).disabled).toBe(false);
        expect(optionLabels(page)).toHaveLength(8);
        expect(amountInput(page).value).toBe('1,250,000');
        expect(descriptionInput(page).value).toBe('Weekly groceries');
        // Previously the jar was cleared here and "Please select a jar." appeared; the value is now kept.
        expect(jarSelect(page).value).toBe('food');
        expect(facts(page, '.summary-panel .jar-summary')['Plan budget']).toBe('2,000,000 VND');
        expect(alertTexts(page)).toEqual([]);
      });

      it('shows the generic save-failed message when the date already moved to another month with a plan', async () => {
        const page = await savePending();
        enterDate(page, '2026-10-05');
        flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);
        expect(optionLabels(page)).toHaveLength(8);

        flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

        expect(alertTexts(page)).toEqual([SAVE_FAILED]);
        expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
        expect(optionLabels(page)).toHaveLength(8);
        expect(jarSelect(page).disabled).toBe(false);
        expect(amountInput(page).value).toBe('1,250,000');
        expect(pending(page)).toEqual([]);
      });

      it('shows the generic save-failed message when the date moved to another month that is still loading', async () => {
        const page = await savePending();
        enterDate(page, '2026-10-05');

        flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

        expect(alertTexts(page)).toEqual([SAVE_FAILED]);
        expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);

        flushOk(page, OCTOBER_PLAN_FIXTURE, OCTOBER);

        expect(optionLabels(page)).toHaveLength(8);
        expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
      });

      it('shows the generic save-failed message when the date was cleared meanwhile', async () => {
        const page = await savePending();
        enter(page, dateInput(page), '');

        flushPostFailure(page, 404, 'Not Found', NOT_FOUND_ERROR_FIXTURE);

        // The date field shows its own error because a submit was attempted; the 404 is not shown as a missing plan.
        expect(alertTexts(page)).toEqual([DATE_ERROR, SAVE_FAILED]);
        expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
      });

      it('treats a 404 without the plan-not-found code as a generic save failure', async () => {
        const page = await savePending();

        flushPostFailure(page, 404, 'Not Found', 'Not Found');

        expect(alertTexts(page)).toEqual([SAVE_FAILED]);
        expect(pageText(page)).not.toContain(NOT_FOUND_TITLE);
        expect(optionLabels(page)).toHaveLength(8);
      });
    });

    describe('500 and network errors', () => {
      it.each<[number, string]>([
        [500, 'Internal Server Error'],
        [503, 'Service Unavailable']
      ])('shows the generic message for a %i and never the raw server message', async (status, statusText) => {
        const page = await savePending();

        flushPostFailure(page, status, statusText, INTERNAL_ERROR_FIXTURE);

        expect(alertTexts(page)).toEqual([SAVE_FAILED]);
        expect(pageText(page)).not.toContain('stack trace');
        expect(pageText(page)).not.toContain(INTERNAL_ERROR_FIXTURE.message);
        expectValuesKept(page);
        expect(saveResult(page)).toBe('');
        expect(jarTotals(page)).toEqual({});
      });

      it('shows the generic message when the server cannot be reached', async () => {
        const page = await savePending();

        postRequest(page).error(new ProgressEvent('error'));
        render(page);

        expect(alertTexts(page)).toEqual([SAVE_FAILED]);
        expectValuesKept(page);
      });

      it('never retries the POST on its own after a server error', async () => {
        const page = await savePending();

        flushPostFailure(page, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

        page.http.expectNone(EXPENSES);
        expect(pending(page)).toEqual([]);
      });

      it('never retries the POST on its own after a network error', async () => {
        const page = await savePending();

        postRequest(page).error(new ProgressEvent('error'));
        render(page);

        page.http.expectNone(EXPENSES);
        expect(pending(page)).toEqual([]);
      });

      it('does not reload the plan after a server error', async () => {
        const page = await savePending();

        flushPostFailure(page, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

        page.http.expectNone(SEPTEMBER);
        expect(optionLabels(page)).toHaveLength(8);
        expect(jarSelect(page).disabled).toBe(false);
      });

      it('clears the failure message on the next submit and sends the same values again', async () => {
        const page = await savePending();
        flushPostFailure(page, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);
        expect(alertTexts(page)).toEqual([SAVE_FAILED]);

        save(page);

        expect(alertTexts(page)).toEqual([]);
        expect(postRequest(page).request.body).toEqual(EXPECTED_BODY);
      });

      it('shows the success state when the second attempt works', async () => {
        const page = await savePending();
        flushPostFailure(page, 500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE);

        save(page);
        flushCreated(page);

        expect(alertTexts(page)).toEqual([]);
        expect(saveResult(page)).toBe('Expense saved: 1,250,000 VND to Food.');
        expect(amountInput(page).value).toBe('');
      });
    });
  });
});
