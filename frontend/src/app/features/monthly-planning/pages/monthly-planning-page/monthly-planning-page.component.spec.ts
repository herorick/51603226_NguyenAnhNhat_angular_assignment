import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BUDGET_PLAN_ENDPOINTS } from '../../../../constants/api-endpoints';
import { ApiErrorResponse } from '../../../../models/api-error.models';
import { DefaultJarsResponse } from '../../../../models/budget-plan.models';
import {
  DEFAULT_JARS_FIXTURE,
  DUPLICATE_PLAN_ERROR_FIXTURE,
  INTERNAL_ERROR_FIXTURE,
  MONTHLY_PLAN_FIXTURE,
  NON_CANONICAL_DEFAULT_JARS_FIXTURE,
  VALIDATION_ERROR_FIXTURE
} from '../../../../testing/fixtures';
import { MonthlyPlanningPageComponent } from './monthly-planning-page.component';

const { DEFAULT_JARS, PLANS } = BUDGET_PLAN_ENDPOINTS;

const PERIOD_ERROR = 'Select a month for this plan.';
const INCOME_ERROR = 'Income must be a positive whole-VND amount.';
const SUMMARY_ERROR = 'Please select a month and enter a positive whole-VND income.';
const SUBMITTING = 'Creating your monthly plan…';
const CREATE_FAILED = 'We could not create your plan. Your values are kept, please try again.';
const LOAD_FAILED = 'We could not load the default allocation.';
const LOADING = 'Loading your default allocation…';

/** Not one of the shared fixtures on purpose: proves names, rates, logic and the total are bound from the response. */
const CUSTOM_JARS_RESPONSE: DefaultJarsResponse = {
  currency: 'VND',
  totalPercentage: 99,
  jars: [
    { jarType: 'savings', name: 'Rainy Day Pot', percentage: 60, suggestedLogic: 'Logic text from the server A.' },
    { jarType: 'food', name: 'Groceries Only', percentage: 39, suggestedLogic: 'Logic text from the server B.' }
  ]
};

interface Page {
  harness: RouterTestingHarness;
  component: MonthlyPlanningPageComponent;
  http: HttpTestingController;
  router: Router;
  root: HTMLElement;
}

type Respond = (request: TestRequest) => void;

const respondWith =
  (status: number, statusText: string, body: ApiErrorResponse): Respond =>
  (request) =>
    request.flush(body, { status, statusText });

const SERVER_FAILURES: [string, Respond][] = [
  ['500 response', respondWith(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE)],
  ['network error', (request) => request.error(new ProgressEvent('error'))]
];

// ---------------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------------

const text = (node: Element | null | undefined): string => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

const el = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`Element not found: ${selector}`);
  }
  return found;
};

const periodInput = (page: Page): HTMLInputElement => el<HTMLInputElement>(page.root, '#period');
const incomeInput = (page: Page): HTMLInputElement => el<HTMLInputElement>(page.root, '#monthly-income');
const periodError = (page: Page): HTMLElement | null => page.root.querySelector<HTMLElement>('#period-error');
const incomeError = (page: Page): HTMLElement | null => page.root.querySelector<HTMLElement>('#income-error');
const statusText = (page: Page): string => text(el(page.root, 'output'));
/** Text of every `role=alert`; alerts with child elements (message + link/button) join the children with a space. */
const alerts = (page: Page): string[] =>
  Array.from(page.root.querySelectorAll('[role=alert]')).map((alert) =>
    alert.children.length > 0 ? Array.from(alert.children).map(text).join(' ') : text(alert)
  );
const buttons = (page: Page): HTMLButtonElement[] => Array.from(page.root.querySelectorAll('button'));

const createButton = (page: Page): HTMLButtonElement => {
  const button = buttons(page).find((candidate) => text(candidate) === 'Create monthly plan');
  if (!button) {
    throw new Error('Create monthly plan button not found');
  }
  return button;
};

const jarSummaries = (page: Page): { name: string; rate: string; logic: string }[] =>
  Array.from(page.root.querySelectorAll('ul[aria-label="Default jar allocation"] > li')).map((item) => ({
    name: text(el(item, '.jar-name')),
    rate: text(el(item, '.jar-rate')),
    logic: text(el(item, '.jar-logic'))
  }));

const expectedSummaries = (response: DefaultJarsResponse): { name: string; rate: string; logic: string }[] =>
  response.jars.map((jar) => ({ name: jar.name, rate: `${jar.percentage}%`, logic: jar.suggestedLogic }));

/** Runs change detection after a synchronous user action. */
const render = (page: Page): void => page.harness.detectChanges();

/** Waits for pending async work (router navigation, microtasks). Only call it when no HTTP request is outstanding. */
const settle = async (page: Page): Promise<void> => {
  await TestBed.inject(ApplicationRef).whenStable();
  render(page);
};

const enter = (page: Page, input: HTMLInputElement, value: string): void => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  render(page);
};

const blur = (page: Page, input: HTMLInputElement): void => {
  input.dispatchEvent(new Event('blur'));
  render(page);
};

const fillValid = (page: Page, period = '2026-09', income = '30,000,000'): void => {
  enter(page, periodInput(page), period);
  enter(page, incomeInput(page), income);
};

const clickCreate = (page: Page): void => {
  createButton(page).click();
  render(page);
};

const createPage = async (): Promise<Page> => {
  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl('/monthly-planning', MonthlyPlanningPageComponent);
  harness.detectChanges();
  const root = harness.routeNativeElement;
  if (root === null) {
    throw new Error('The routed page was not rendered');
  }
  return { harness, component, http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router), root };
};

const flushJars = async (page: Page, body: DefaultJarsResponse = DEFAULT_JARS_FIXTURE): Promise<void> => {
  page.http.expectOne(DEFAULT_JARS).flush(body);
  await settle(page);
};

const readyPage = async (body: DefaultJarsResponse = DEFAULT_JARS_FIXTURE): Promise<Page> => {
  const page = await createPage();
  await flushJars(page, body);
  return page;
};

const flushCreated = (request: TestRequest): void =>
  request.flush(MONTHLY_PLAN_FIXTURE, { status: 201, statusText: 'Created' });

// ---------------------------------------------------------------------------------------------------------------------

describe('MonthlyPlanningPageComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'monthly-planning', component: MonthlyPlanningPageComponent },
          { path: 'monthly-plans/:year/:month', children: [] }
        ]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('initial load (TC_F1_001, AC1)', () => {
    it('requests the default jars exactly once and sends no create request', async () => {
      const page = await createPage();

      const request = page.http.expectOne(DEFAULT_JARS);
      expect(request.request.method).toBe('GET');
      page.http.expectNone(PLANS);

      request.flush(DEFAULT_JARS_FIXTURE);
    });

    it('shows the loading message and keeps Create disabled while the jars are pending', async () => {
      const page = await createPage();

      expect(text(page.root)).toContain(LOADING);
      expect(el(page.root, '.loading').getAttribute('aria-live')).toBe('polite');
      expect(createButton(page).disabled).toBe(true);
      expect(page.root.querySelector('ul[aria-label="Default jar allocation"]')).toBeNull();
      expect(page.root.querySelector('.allocation-status')).toBeNull();

      await flushJars(page);

      expect(text(page.root)).not.toContain(LOADING);
    });

    it('exposes labelled Month and Monthly income controls and the Create button', async () => {
      const page = await createPage();

      const monthLabel = el<HTMLLabelElement>(page.root, 'label[for="period"]');
      expect(text(monthLabel)).toContain('Month');
      const month = el<HTMLInputElement>(page.root, `#${monthLabel.htmlFor}`);
      expect(month.type).toBe('month');
      expect(month.getAttribute('aria-required')).toBe('true');

      const incomeLabel = el<HTMLLabelElement>(page.root, 'label[for="monthly-income"]');
      expect(text(incomeLabel)).toContain('Monthly income');
      const income = el<HTMLInputElement>(page.root, `#${incomeLabel.htmlFor}`);
      expect(income.type).toBe('text');
      expect(income.getAttribute('inputmode')).toBe('numeric');
      expect(income.getAttribute('aria-required')).toBe('true');
      expect(text(el(page.root, '.currency-suffix'))).toBe('VND');

      expect(createButton(page).type).toBe('submit');
      expect(month.value).toBe('');
      expect(income.value).toBe('');

      await flushJars(page);
    });

    it('shows no field errors and no status text before the user interacts', async () => {
      const page = await readyPage();

      expect(periodError(page)).toBeNull();
      expect(incomeError(page)).toBeNull();
      expect(statusText(page)).toBe('');
      expect(alerts(page)).toEqual([]);
      expect(periodInput(page).hasAttribute('aria-invalid')).toBe(false);
      expect(periodInput(page).hasAttribute('aria-describedby')).toBe(false);
      expect(incomeInput(page).hasAttribute('aria-invalid')).toBe(false);
      expect(incomeInput(page).hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('ready state (TC_F1_006, TC_F1_007, TC_F1_008, AC5)', () => {
    it('renders the seven jars in response order with names, rates and logic from the response', async () => {
      const page = await readyPage();

      expect(jarSummaries(page)).toHaveLength(7);
      expect(jarSummaries(page)).toEqual(expectedSummaries(DEFAULT_JARS_FIXTURE));
      expect(el(page.root, '#allocation-title').textContent).toBe('Your default allocation');
    });

    it('enables Create and shows "100% allocated" from totalPercentage', async () => {
      const page = await readyPage();

      expect(createButton(page).disabled).toBe(false);
      expect(text(el(page.root, '.allocation-status'))).toContain('100% allocated');
      expect(alerts(page)).toEqual([]);
    });

    it('renders a non-canonical response order as-is without sorting', async () => {
      const page = await readyPage(NON_CANONICAL_DEFAULT_JARS_FIXTURE);

      const names = jarSummaries(page).map((jar) => jar.name);
      expect(names).toEqual(NON_CANONICAL_DEFAULT_JARS_FIXTURE.jars.map((jar) => jar.name));
      expect(names[0]).not.toBe(DEFAULT_JARS_FIXTURE.jars[0].name);
      expect(names[names.length - 1]).toBe(DEFAULT_JARS_FIXTURE.jars[0].name);
    });

    it('binds jars and totalPercentage from the response instead of hardcoding them', async () => {
      const page = await readyPage(CUSTOM_JARS_RESPONSE);

      expect(jarSummaries(page)).toEqual([
        { name: 'Rainy Day Pot', rate: '60%', logic: 'Logic text from the server A.' },
        { name: 'Groceries Only', rate: '39%', logic: 'Logic text from the server B.' }
      ]);
      expect(text(el(page.root, '.allocation-status'))).toContain('99% allocated');
      expect(text(el(page.root, '.allocation-status'))).not.toContain('100%');
    });
  });

  describe('default jars failure', () => {
    it.each(SERVER_FAILURES)('shows an alert with Try again on %s and keeps Create disabled', async (_label, fail) => {
      const page = await createPage();

      fail(page.http.expectOne(DEFAULT_JARS));
      await settle(page);

      expect(alerts(page)).toEqual([`${LOAD_FAILED} Try again`]);
      expect(text(page.root)).not.toContain('Unhandled exception');
      expect(text(page.root)).not.toContain('stack trace');
      expect(text(page.root)).not.toContain(LOADING);
      expect(page.root.querySelector('.allocation-status')).toBeNull();
      expect(jarSummaries(page)).toEqual([]);
      expect(createButton(page).disabled).toBe(true);
    });

    it.each(SERVER_FAILURES)('Try again refetches after a %s, then shows the jars', async (_label, fail) => {
      const page = await createPage();
      fail(page.http.expectOne(DEFAULT_JARS));
      await settle(page);

      const retry = buttons(page).find((button) => text(button) === 'Try again');
      expect(retry?.type).toBe('button');
      retry?.click();
      render(page);

      expect(text(page.root)).toContain(LOADING);
      expect(alerts(page)).toEqual([]);
      expect(createButton(page).disabled).toBe(true);
      const second = page.http.expectOne(DEFAULT_JARS);
      expect(second.request.method).toBe('GET');
      second.flush(DEFAULT_JARS_FIXTURE);
      await settle(page);

      expect(jarSummaries(page)).toEqual(expectedSummaries(DEFAULT_JARS_FIXTURE));
      expect(alerts(page)).toEqual([]);
      expect(createButton(page).disabled).toBe(false);
    });

    it('shows the error again when the retry fails too', async () => {
      const page = await createPage();
      SERVER_FAILURES[0][1](page.http.expectOne(DEFAULT_JARS));
      await settle(page);

      buttons(page)
        .find((button) => text(button) === 'Try again')
        ?.click();
      render(page);
      SERVER_FAILURES[1][1](page.http.expectOne(DEFAULT_JARS));
      await settle(page);

      expect(alerts(page)).toEqual([`${LOAD_FAILED} Try again`]);
      expect(createButton(page).disabled).toBe(true);
    });

    it('does not send a create request when submitted while the jars are not ready', async () => {
      const page = await createPage();
      fillValid(page);

      createButton(page).click();
      el<HTMLFormElement>(page.root, 'form').dispatchEvent(new Event('submit'));
      render(page);

      page.http.expectNone(PLANS);
      await flushJars(page);
      page.http.expectNone(PLANS);
    });
  });

  describe('client validation (TC_F1_003, TC_F1_004, TC_F1_011, AC3)', () => {
    it('rejects an empty form with both messages, aria links, status text and focus on Month', async () => {
      const page = await readyPage();

      expect(createButton(page).disabled).toBe(false);
      clickCreate(page);

      page.http.expectNone(PLANS);
      expect(text(periodError(page))).toBe(PERIOD_ERROR);
      expect(text(incomeError(page))).toBe(INCOME_ERROR);
      expect(periodInput(page).getAttribute('aria-invalid')).toBe('true');
      expect(periodInput(page).getAttribute('aria-describedby')).toBe('period-error');
      expect(incomeInput(page).getAttribute('aria-invalid')).toBe('true');
      expect(incomeInput(page).getAttribute('aria-describedby')).toBe('income-error');
      expect(statusText(page)).toBe(SUMMARY_ERROR);
      expect(document.activeElement).toBe(periodInput(page));
      expect(createButton(page).disabled).toBe(false);
    });

    it('keeps the month invalid when it is left empty and focuses Month first', async () => {
      const page = await readyPage();
      enter(page, incomeInput(page), '30,000,000');

      clickCreate(page);

      page.http.expectNone(PLANS);
      expect(text(periodError(page))).toBe(PERIOD_ERROR);
      expect(incomeError(page)).toBeNull();
      expect(document.activeElement).toBe(periodInput(page));
      expect(incomeInput(page).value).toBe('30,000,000');
    });

    it.each(['', '0', '000', '-1', '1.5', 'abc', '1e3', '1,5', '1,0,0', '   ', '9223372036854775808'])(
      'rejects income %j for a valid month, keeps the typed value and focuses Income',
      async (value) => {
        const page = await readyPage();
        fillValid(page, '2026-09', value);

        clickCreate(page);

        page.http.expectNone(PLANS);
        expect(text(incomeError(page))).toBe(INCOME_ERROR);
        expect(incomeInput(page).getAttribute('aria-invalid')).toBe('true');
        expect(incomeInput(page).getAttribute('aria-describedby')).toBe('income-error');
        expect(periodError(page)).toBeNull();
        expect(periodInput(page).hasAttribute('aria-invalid')).toBe(false);
        expect(statusText(page)).toBe(SUMMARY_ERROR);
        expect(document.activeElement).toBe(incomeInput(page));
        expect(incomeInput(page).value).toBe(value);
        expect(periodInput(page).value).toBe('2026-09');
      }
    );

    it('shows the Month error on blur, before any submit attempt', async () => {
      const page = await readyPage();
      expect(periodError(page)).toBeNull();

      blur(page, periodInput(page));

      expect(text(periodError(page))).toBe(PERIOD_ERROR);
      expect(periodInput(page).getAttribute('aria-invalid')).toBe('true');
      expect(periodInput(page).getAttribute('aria-describedby')).toBe('period-error');
      expect(incomeError(page)).toBeNull();
      expect(statusText(page)).toBe('');
      page.http.expectNone(PLANS);
    });

    it('shows the Income error on blur, before any submit attempt', async () => {
      const page = await readyPage();
      enter(page, incomeInput(page), 'abc');
      expect(incomeError(page)).toBeNull();

      blur(page, incomeInput(page));

      expect(text(incomeError(page))).toBe(INCOME_ERROR);
      expect(incomeError(page)?.getAttribute('role')).toBe('alert');
      expect(incomeInput(page).getAttribute('aria-invalid')).toBe('true');
      expect(incomeInput(page).value).toBe('abc');
      expect(periodError(page)).toBeNull();
      expect(statusText(page)).toBe('');
      page.http.expectNone(PLANS);
    });

    // Natural tab order: Month is blurred first, then the user types a bad income and leaves the field. The FormGroup
    // emits no touched event for the second control, so the page also listens to each control's events.
    it('shows the Income error on blur after Month was already blurred', async () => {
      const page = await readyPage();
      blur(page, periodInput(page));
      enter(page, incomeInput(page), 'abc');
      expect(incomeError(page)).toBeNull();

      blur(page, incomeInput(page));

      expect(text(incomeError(page))).toBe(INCOME_ERROR);
      expect(incomeInput(page).getAttribute('aria-invalid')).toBe('true');
      expect(statusText(page)).toBe('');
    });

    it('clears an error as soon as the value becomes valid', async () => {
      const page = await readyPage();
      clickCreate(page);
      expect(periodError(page)).not.toBeNull();
      expect(incomeError(page)).not.toBeNull();

      enter(page, periodInput(page), '2026-09');
      expect(periodError(page)).toBeNull();
      expect(periodInput(page).hasAttribute('aria-invalid')).toBe(false);
      expect(incomeError(page)).not.toBeNull();

      enter(page, incomeInput(page), '1,000');
      expect(incomeError(page)).toBeNull();
      expect(statusText(page)).toBe('');
    });

    it('accepts the lower boundary of 1 and posts it as the string "1" (TC_F1_003)', async () => {
      const page = await readyPage();
      fillValid(page, '2026-09', '1');

      clickCreate(page);

      const request = page.http.expectOne(PLANS);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ year: 2026, month: 9, monthlyIncomeVnd: '1' });
      flushCreated(request);
      await settle(page);
    });

    it('accepts the largest int64 amount without losing precision', async () => {
      const page = await readyPage();
      fillValid(page, '2026-09', '9,223,372,036,854,775,807');

      clickCreate(page);

      const request = page.http.expectOne(PLANS);
      expect(request.request.body).toEqual({ year: 2026, month: 9, monthlyIncomeVnd: '9223372036854775807' });
      flushCreated(request);
      await settle(page);
    });

    // jsdom sanitizes <input type="month"> like a browser: values that are not a valid month string become ''.
    // Either way the control must be invalid, show the period error and send nothing.
    it.each(['0000-05', '10000-01', '2026-13', '2026-00', 'not-a-month'])(
      'rejects the out-of-range month %j without calling the API',
      async (value) => {
        const page = await readyPage();
        enter(page, incomeInput(page), '30,000,000');
        enter(page, periodInput(page), value);

        clickCreate(page);

        page.http.expectNone(PLANS);
        expect(text(periodError(page))).toBe(PERIOD_ERROR);
        expect(periodInput(page).getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(periodInput(page));
      }
    );

    // Bypasses the input sanitization above so the page's own year range check is exercised for sure.
    it.each(['0000-05', '10000-01', '2026-13', '2026-00'])(
      'rejects the month %j when it reaches the form control unchanged',
      async (value) => {
        const page = await readyPage();
        enter(page, incomeInput(page), '30,000,000');
        page.component.form.controls.period.setValue(value);
        render(page);

        clickCreate(page);

        page.http.expectNone(PLANS);
        expect(text(periodError(page))).toBe(PERIOD_ERROR);
        expect(document.activeElement).toBe(periodInput(page));
      }
    );

    it.each([
      ['0001-01', { year: 1, month: 1 }],
      ['9999-12', { year: 9999, month: 12 }]
    ])('accepts the boundary month %s', async (value, expected) => {
      const page = await readyPage();
      fillValid(page, value, '5,000,000');

      clickCreate(page);

      const request = page.http.expectOne(PLANS);
      expect(request.request.body).toEqual({ ...expected, monthlyIncomeVnd: '5000000' });
      flushCreated(request);
      await settle(page);
    });
  });

  describe('valid submit (TC_F1_002, AC2)', () => {
    it('posts the exact normalized body once, shows progress, then navigates to the plan', async () => {
      const page = await readyPage();
      fillValid(page, '2026-09', '30,000,000');

      clickCreate(page);

      const request = page.http.expectOne(PLANS);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ year: 2026, month: 9, monthlyIncomeVnd: '30000000' });
      expect(typeof request.request.body.monthlyIncomeVnd).toBe('string');
      expect(createButton(page).disabled).toBe(true);
      expect(statusText(page)).toBe(SUBMITTING);
      expect(el(page.root, 'output').getAttribute('aria-live')).toBe('polite');
      expect(page.router.url).toBe('/monthly-planning');

      flushCreated(request);
      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2026/9');
    });

    it('keeps the form locked until the router settles, then releases it', async () => {
      const page = await readyPage();
      fillValid(page);

      clickCreate(page);
      flushCreated(page.http.expectOne(PLANS));

      expect(page.component.submitting()).toBe(true);
      expect(page.component.submitDisabled()).toBe(true);

      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2026/9');
      expect(page.component.submitting()).toBe(false);
    });

    it('navigates using the submitted year and month', async () => {
      const page = await readyPage();
      fillValid(page, '2027-01', '12000000');

      clickCreate(page);

      const request = page.http.expectOne(PLANS);
      expect(request.request.body).toEqual({ year: 2027, month: 1, monthlyIncomeVnd: '12000000' });
      request.flush({ ...MONTHLY_PLAN_FIXTURE, year: 2027, month: 1 }, { status: 201, statusText: 'Created' });
      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2027/1');
    });

    it('trims surrounding whitespace and never converts large amounts to a number', async () => {
      const page = await readyPage();
      fillValid(page, '2026-12', '  9007199254740993 ');

      clickCreate(page);

      const request = page.http.expectOne(PLANS);
      expect(request.request.body).toEqual({ year: 2026, month: 12, monthlyIncomeVnd: '9007199254740993' });
      flushCreated(request);
      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2026/12');
    });

    it('sends one request for a double click and ignores a second submit event while pending', async () => {
      const page = await readyPage();
      fillValid(page);

      const button = createButton(page);
      button.click();
      button.click();
      render(page);
      el<HTMLFormElement>(page.root, 'form').dispatchEvent(new Event('submit'));
      render(page);

      const requests = page.http.match(PLANS);
      expect(requests).toHaveLength(1);
      page.http.expectNone(PLANS);
      expect(createButton(page).disabled).toBe(true);

      flushCreated(requests[0]);
      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2026/9');
    });
  });

  describe('duplicate plan, 409 (TC_F1_005, AC4)', () => {
    const submitDuplicate = async (): Promise<Page> => {
      const page = await readyPage();
      fillValid(page, '2026-09', '30,000,000');
      clickCreate(page);
      respondWith(409, 'Conflict', DUPLICATE_PLAN_ERROR_FIXTURE)(page.http.expectOne(PLANS));
      await settle(page);
      return page;
    };

    it('shows the server message with a link to the existing plan and keeps the typed values', async () => {
      const page = await submitDuplicate();

      expect(alerts(page)).toEqual([`${DUPLICATE_PLAN_ERROR_FIXTURE.message} View the existing plan`]);
      const link = el<HTMLAnchorElement>(page.root, '[role=alert] a');
      expect(text(link)).toBe('View the existing plan');
      expect(link.getAttribute('href')).toBe('/monthly-plans/2026/9');
      expect(periodInput(page).value).toBe('2026-09');
      expect(incomeInput(page).value).toBe('30,000,000');
      expect(page.router.url).toBe('/monthly-planning');
      expect(createButton(page).disabled).toBe(false);
      expect(statusText(page)).toBe('');
      expect(periodError(page)).toBeNull();
      expect(incomeError(page)).toBeNull();
    });

    it('opens the existing plan when the link is followed', async () => {
      const page = await submitDuplicate();

      el<HTMLAnchorElement>(page.root, '[role=alert] a').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2026/9');
    });

    it('clears the conflict alert when the month changes', async () => {
      const page = await submitDuplicate();

      enter(page, periodInput(page), '2026-10');

      expect(alerts(page)).toEqual([]);
      expect(incomeInput(page).value).toBe('30,000,000');
    });

    it('clears the conflict when the user submits again and shows it once more on a repeated 409', async () => {
      const page = await submitDuplicate();

      clickCreate(page);
      expect(alerts(page)).toEqual([]);
      respondWith(409, 'Conflict', DUPLICATE_PLAN_ERROR_FIXTURE)(page.http.expectOne(PLANS));
      await settle(page);

      expect(alerts(page)).toHaveLength(1);
      expect(createButton(page).disabled).toBe(false);
    });
  });

  describe('400 VALIDATION_ERROR from the server', () => {
    const submitValid = (page: Page): void => {
      fillValid(page, '2026-09', '30,000,000');
      clickCreate(page);
    };

    it('shows each server message under its field with aria links, keeps values and focuses Month', async () => {
      const page = await readyPage();
      submitValid(page);

      respondWith(400, 'Bad Request', VALIDATION_ERROR_FIXTURE)(page.http.expectOne(PLANS));
      await settle(page);

      expect(text(periodError(page))).toBe('Month must be between 1 and 12.');
      expect(text(incomeError(page))).toBe('Monthly income must be greater than zero.');
      expect(periodInput(page).getAttribute('aria-invalid')).toBe('true');
      expect(periodInput(page).getAttribute('aria-describedby')).toBe('period-error');
      expect(incomeInput(page).getAttribute('aria-invalid')).toBe('true');
      expect(incomeInput(page).getAttribute('aria-describedby')).toBe('income-error');
      expect(periodInput(page).value).toBe('2026-09');
      expect(incomeInput(page).value).toBe('30,000,000');
      expect(document.activeElement).toBe(periodInput(page));
      // Only the field errors are announced: the envelope message is not repeated in a form-level alert.
      expect(alerts(page)).toEqual(['Month must be between 1 and 12.', 'Monthly income must be greater than zero.']);
      expect(createButton(page).disabled).toBe(false);
      expect(page.router.url).toBe('/monthly-planning');
    });

    it('clears a server field error as soon as that field is edited', async () => {
      const page = await readyPage();
      submitValid(page);
      respondWith(400, 'Bad Request', VALIDATION_ERROR_FIXTURE)(page.http.expectOne(PLANS));
      await settle(page);

      enter(page, periodInput(page), '2026-10');
      expect(periodError(page)).toBeNull();
      expect(periodInput(page).hasAttribute('aria-invalid')).toBe(false);
      expect(text(incomeError(page))).toBe('Monthly income must be greater than zero.');

      enter(page, incomeInput(page), '31,000,000');
      expect(incomeError(page)).toBeNull();
      expect(incomeInput(page).hasAttribute('aria-invalid')).toBe(false);
    });

    it('clears server errors when the form is submitted again', async () => {
      const page = await readyPage();
      submitValid(page);
      respondWith(400, 'Bad Request', VALIDATION_ERROR_FIXTURE)(page.http.expectOne(PLANS));
      await settle(page);

      clickCreate(page);

      expect(periodError(page)).toBeNull();
      expect(incomeError(page)).toBeNull();
      expect(statusText(page)).toBe(SUBMITTING);
      flushCreated(page.http.expectOne(PLANS));
      await settle(page);
    });

    it('shows only the income error and focuses Income when the server rejects just the income', async () => {
      const page = await readyPage();
      submitValid(page);

      respondWith(400, 'Bad Request', {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields are invalid.',
        errors: [{ field: 'monthlyIncomeVnd', code: 'TOO_LARGE', message: 'Income is too large.' }]
      })(page.http.expectOne(PLANS));
      await settle(page);

      expect(text(incomeError(page))).toBe('Income is too large.');
      expect(periodError(page)).toBeNull();
      expect(document.activeElement).toBe(incomeInput(page));
      expect(alerts(page)).toEqual(['Income is too large.']);
    });

    it('maps a year field error to the Month control', async () => {
      const page = await readyPage();
      submitValid(page);

      respondWith(400, 'Bad Request', {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields are invalid.',
        errors: [{ field: 'year', code: 'OUT_OF_RANGE', message: 'Year must be between 1 and 9999.' }]
      })(page.http.expectOne(PLANS));
      await settle(page);

      expect(text(periodError(page))).toBe('Year must be between 1 and 9999.');
      expect(incomeError(page)).toBeNull();
      expect(document.activeElement).toBe(periodInput(page));
    });

    it('shows only the envelope message in an alert when the field is unknown', async () => {
      const page = await readyPage();
      submitValid(page);

      respondWith(400, 'Bad Request', {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields are invalid.',
        errors: [{ field: 'somethingElse', code: 'INVALID', message: 'Something else is wrong.' }]
      })(page.http.expectOne(PLANS));
      await settle(page);

      expect(alerts(page)).toEqual(['One or more fields are invalid.']);
      expect(text(page.root)).not.toContain('Something else is wrong.');
      expect(periodError(page)).toBeNull();
      expect(incomeError(page)).toBeNull();
      expect(periodInput(page).value).toBe('2026-09');
      expect(incomeInput(page).value).toBe('30,000,000');
      expect(createButton(page).disabled).toBe(false);
    });

    it('shows the envelope message in an alert when a 400 carries no field errors', async () => {
      const page = await readyPage();
      submitValid(page);

      respondWith(400, 'Bad Request', {
        code: 'VALIDATION_ERROR',
        message: 'Request body is invalid.',
        errors: []
      })(page.http.expectOne(PLANS));
      await settle(page);

      expect(alerts(page)).toEqual(['Request body is invalid.']);
      expect(createButton(page).disabled).toBe(false);
    });
  });

  describe('server and network failure on create', () => {
    it.each(SERVER_FAILURES)(
      'shows a generic alert on %s, keeps values, re-enables Create and does not retry',
      async (_label, fail) => {
        const page = await readyPage();
        fillValid(page, '2026-09', '30,000,000');
        clickCreate(page);
        expect(createButton(page).disabled).toBe(true);

        fail(page.http.expectOne(PLANS));
        await settle(page);

        expect(alerts(page)).toEqual([CREATE_FAILED]);
        expect(text(page.root)).not.toContain('Unhandled exception');
        expect(text(page.root)).not.toContain('stack trace');
        expect(periodInput(page).value).toBe('2026-09');
        expect(incomeInput(page).value).toBe('30,000,000');
        expect(createButton(page).disabled).toBe(false);
        expect(statusText(page)).toBe('');
        expect(periodError(page)).toBeNull();
        expect(incomeError(page)).toBeNull();
        expect(page.router.url).toBe('/monthly-planning');
        page.http.expectNone(PLANS);
      }
    );

    it.each(SERVER_FAILURES)('sends a fresh POST when the user submits again after a %s', async (_label, fail) => {
      const page = await readyPage();
      fillValid(page, '2026-09', '30,000,000');
      clickCreate(page);
      fail(page.http.expectOne(PLANS));
      await settle(page);

      clickCreate(page);

      expect(alerts(page)).toEqual([]);
      expect(statusText(page)).toBe(SUBMITTING);
      const second = page.http.expectOne(PLANS);
      expect(second.request.method).toBe('POST');
      expect(second.request.body).toEqual({ year: 2026, month: 9, monthlyIncomeVnd: '30000000' });
      flushCreated(second);
      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2026/9');
    });

    it('shows the generic alert for an unexpected 404 on create', async () => {
      const page = await readyPage();
      fillValid(page);
      clickCreate(page);

      respondWith(404, 'Not Found', {
        code: 'MONTHLY_PLAN_NOT_FOUND',
        message: 'Server detail that should not be shown.',
        errors: []
      })(page.http.expectOne(PLANS));
      await settle(page);

      expect(alerts(page)).toEqual([CREATE_FAILED]);
      expect(createButton(page).disabled).toBe(false);
    });
  });
});
