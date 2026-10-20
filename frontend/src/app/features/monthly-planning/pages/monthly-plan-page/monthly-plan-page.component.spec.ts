import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUDGET_PLAN_ENDPOINTS } from '../../../../constants/api-endpoints';
import { BudgetPlanApiService } from '../../../../core/services/budget-plan-api.service';
import { MonthlyPlanResponse } from '../../../../models/budget-plan.models';
import { jarColor } from '../../../../shared/constants/jar-colors';
import {
  INTERNAL_ERROR_FIXTURE,
  MONTHLY_PLAN_FIXTURE,
  NON_CANONICAL_MONTHLY_PLAN_FIXTURE,
  NOT_FOUND_ERROR_FIXTURE,
  VALIDATION_ERROR_FIXTURE
} from '../../../../testing/fixtures';
import { MonthlyPlanPageComponent } from './monthly-plan-page.component';

const { BY_PERIOD } = BUDGET_PLAN_ENDPOINTS;

const SEPTEMBER = BY_PERIOD(2026, 9);
const OCTOBER = BY_PERIOD(2026, 10);

const TITLE = 'Month Budget Summary';
const LOADING = 'Loading monthly plan…';
const NOT_FOUND_TITLE = 'Monthly plan unavailable';
const LOAD_FAILED = 'We could not load this monthly plan. Please try again.';
const INTEGRITY_FAILED = 'The monthly plan data is incomplete or invalid. Please try again.';
const NETWORK_FAILED = 'We could not reach the server. Check your connection and try again.';
const INVALID_PERIOD = 'This monthly plan link is not valid. Choose a month from monthly planning.';

/** Response order of `MONTHLY_PLAN_FIXTURE`, as the user sees it (formatted by the vnd pipe). */
const CANONICAL_CARDS = [
  { name: 'Living Expenses', rate: '35%', budget: '8,750,000 VND' },
  { name: 'Food', rate: '20%', budget: '5,000,000 VND' },
  { name: 'Children', rate: '10%', budget: '2,500,000 VND' },
  { name: 'Emergency Fund', rate: '10%', budget: '2,500,000 VND' },
  { name: 'Savings', rate: '10%', budget: '2,500,000 VND' },
  { name: 'Investment', rate: '10%', budget: '2,500,000 VND' },
  { name: 'Entertainment & Travel', rate: '5%', budget: '1,250,000 VND' }
];

/** Donut slice per jar, in response order: backend percentage as the dash length, running position as the offset. */
const CANONICAL_DONUT = [
  { dash: '35 100', offset: '0' },
  { dash: '20 100', offset: '-35' },
  { dash: '10 100', offset: '-55' },
  { dash: '10 100', offset: '-65' },
  { dash: '10 100', offset: '-75' },
  { dash: '10 100', offset: '-85' },
  { dash: '5 100', offset: '-95' }
];

const REVERSED_DONUT = [
  { dash: '5 100', offset: '0' },
  { dash: '10 100', offset: '-5' },
  { dash: '10 100', offset: '-15' },
  { dash: '10 100', offset: '-25' },
  { dash: '10 100', offset: '-35' },
  { dash: '20 100', offset: '-45' },
  { dash: '35 100', offset: '-65' }
];

/**
 * Not the shared fixture on purpose: names, rates and budgets that no frontend constant or arithmetic could produce
 * (a 10,000,003 income with remainder-style budgets), so every value must come from the response.
 */
const OCTOBER_PLAN: MonthlyPlanResponse = {
  id: 2,
  year: 2026,
  month: 10,
  monthlyIncomeVnd: '10000003',
  currency: 'VND',
  createdAtUtc: '2026-10-01T00:00:00Z',
  jars: [
    { jarType: 'savings', name: 'Rainy Day Pot', percentage: 40, budgetVnd: '4000001' },
    { jarType: 'food', name: 'Groceries Only', percentage: 25, budgetVnd: '2500001' },
    { jarType: 'children', name: 'Kids', percentage: 10, budgetVnd: '1000000' },
    { jarType: 'livingExpenses', name: 'Home', percentage: 10, budgetVnd: '1000000' },
    { jarType: 'investment', name: 'Growth', percentage: 5, budgetVnd: '500000' },
    { jarType: 'emergencyFund', name: 'Safety Net', percentage: 5, budgetVnd: '500000' },
    { jarType: 'entertainmentAndTravel', name: 'Fun', percentage: 5, budgetVnd: '500001' }
  ]
};

const OCTOBER_CARDS = [
  { name: 'Rainy Day Pot', rate: '40%', budget: '4,000,001 VND' },
  { name: 'Groceries Only', rate: '25%', budget: '2,500,001 VND' },
  { name: 'Kids', rate: '10%', budget: '1,000,000 VND' },
  { name: 'Home', rate: '10%', budget: '1,000,000 VND' },
  { name: 'Growth', rate: '5%', budget: '500,000 VND' },
  { name: 'Safety Net', rate: '5%', budget: '500,000 VND' },
  { name: 'Fun', rate: '5%', budget: '500,001 VND' }
];

/** 200 bodies that fail the integrity check. `flush` takes any object, so no cast is needed. */
const JARS = MONTHLY_PLAN_FIXTURE.jars;
const MALFORMED_PLANS: [string, object | null][] = [
  ['six jars', { ...MONTHLY_PLAN_FIXTURE, jars: JARS.slice(0, 6) }],
  ['eight jars', { ...MONTHLY_PLAN_FIXTURE, jars: [...JARS, JARS[0]] }],
  ['duplicate jar types', { ...MONTHLY_PLAN_FIXTURE, jars: [...JARS.slice(0, 6), JARS[1]] }],
  ['unknown jar type', { ...MONTHLY_PLAN_FIXTURE, jars: [{ ...JARS[0], jarType: 'luxury' }, ...JARS.slice(1)] }],
  ['USD currency', { ...MONTHLY_PLAN_FIXTURE, currency: 'USD' }],
  ['income with grouping separators', { ...MONTHLY_PLAN_FIXTURE, monthlyIncomeVnd: '25,000,000' }],
  ['income with a decimal part', { ...MONTHLY_PLAN_FIXTURE, monthlyIncomeVnd: '25000000.5' }],
  ['income that is a number, not a string', { ...MONTHLY_PLAN_FIXTURE, monthlyIncomeVnd: 25000000 }],
  [
    'jar budget with letters',
    { ...MONTHLY_PLAN_FIXTURE, jars: [{ ...JARS[0], budgetVnd: '8.75M' }, ...JARS.slice(1)] }
  ],
  [
    'jar percentage that is a string',
    { ...MONTHLY_PLAN_FIXTURE, jars: [{ ...JARS[0], percentage: '35' }, ...JARS.slice(1)] }
  ],
  ['jars missing', { ...MONTHLY_PLAN_FIXTURE, jars: undefined }],
  ['a plan for another month than the route', { ...MONTHLY_PLAN_FIXTURE, month: 10 }],
  ['a plan for another year than the route', { ...MONTHLY_PLAN_FIXTURE, year: 2025 }],
  ['empty body', null]
];

const INVALID_ROUTES = [
  '/monthly-plans/abc/9',
  '/monthly-plans/2026/13',
  '/monthly-plans/0/1',
  '/monthly-plans/2026/1.5',
  '/monthly-plans/2026/0',
  '/monthly-plans/10000/1',
  '/monthly-plans/2026/abc',
  '/monthly-plans/-1/5'
];

type Body = object | string | null;
type Respond = (request: TestRequest) => void;

interface Page {
  harness: RouterTestingHarness;
  component: MonthlyPlanPageComponent;
  http: HttpTestingController;
  router: Router;
  root: HTMLElement;
}

const ok =
  (body: Body): Respond =>
  (request) =>
    request.flush(body);

const fail =
  (status: number, statusText: string, body: Body): Respond =>
  (request) =>
    request.flush(body, { status, statusText });

const NETWORK_FAILURE: Respond = (request) => request.error(new ProgressEvent('error'));

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

const els = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

const headings = (page: Page, tag: string): string[] => els(page.root, tag).map(text);
const alerts = (page: Page): HTMLElement[] => els(page.root, '[role=alert]');
const buttons = (page: Page): HTMLButtonElement[] => els<HTMLButtonElement>(page.root, 'button');

const link = (page: Page, label: string): HTMLAnchorElement => {
  const found = els<HTMLAnchorElement>(page.root, 'a').find((anchor) => text(anchor).includes(label));
  if (!found) {
    throw new Error(`Link not found: ${label}`);
  }
  return found;
};

const hasLink = (page: Page, label: string): boolean =>
  els<HTMLAnchorElement>(page.root, 'a').some((anchor) => text(anchor).includes(label));

const retryButton = (page: Page): HTMLButtonElement => {
  const found = buttons(page).find((button) => text(button) === 'Try again');
  if (!found) {
    throw new Error('Try again button not found');
  }
  return found;
};

const jarCards = (page: Page): { name: string; rate: string; budget: string }[] =>
  els(page.root, '.jar-grid > li').map((card) => ({
    name: text(el(card, 'h3')),
    rate: text(el(card, '.jar-rate')),
    budget: text(el(card, '.jar-amount'))
  }));

const legendItems = (page: Page): string[] =>
  els(page.root, 'ul[aria-label="Jar allocation legend"] > li').map(
    (item) => `${text(el(item, '.legend-name'))} ${text(el(item, '.legend-rate'))}`
  );
const donutCircles = (page: Page): SVGCircleElement[] => els<SVGCircleElement>(page.root, '.donut svg circle');

/** Runs change detection after a synchronous user action. */
const render = (page: Page): void => page.harness.detectChanges();

/** Waits for pending async work (router navigation, microtasks). Only call it when no HTTP request is outstanding. */
const settle = async (page: Page): Promise<void> => {
  await TestBed.inject(ApplicationRef).whenStable();
  render(page);
};

const createPage = async (url = '/monthly-plans/2026/9'): Promise<Page> => {
  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(url, MonthlyPlanPageComponent);
  harness.detectChanges();
  const root = harness.routeNativeElement;
  if (root === null) {
    throw new Error('The routed page was not rendered');
  }
  return { harness, component, http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router), root };
};

/** Answers the one outstanding GET for `url`, then lets the view settle. */
const answer = async (page: Page, respond: Respond, url = SEPTEMBER): Promise<void> => {
  respond(page.http.expectOne(url));
  await settle(page);
};

/** `url` is the route to open, `apiUrl` the GET that route is expected to trigger. */
const readyPage = async (
  body: Body = MONTHLY_PLAN_FIXTURE,
  url = '/monthly-plans/2026/9',
  apiUrl = SEPTEMBER
): Promise<Page> => {
  const page = await createPage(url);
  await answer(page, ok(body), apiUrl);
  return page;
};

const failedPage = async (respond: Respond): Promise<Page> => {
  const page = await createPage();
  await answer(page, respond);
  return page;
};

/** No amount, percentage, jar card or donut slice may be on screen. */
const expectNoAmounts = (page: Page): void => {
  const content = text(page.root);
  expect(content).not.toContain('VND');
  expect(content).not.toMatch(/\d,\d{3}/);
  expect(content).not.toContain('%');
  expect(page.root.querySelector('.jar-grid')).toBeNull();
  expect(page.root.querySelector('.income-value')).toBeNull();
  expect(page.root.querySelector('svg circle')).toBeNull();
};

const expectReady = (page: Page): void => {
  expect(headings(page, 'h1')).toEqual([TITLE]);
  expect(el(page.root, '.income-value').textContent).toContain('VND');
  expect(alerts(page)).toHaveLength(0);
};

// ---------------------------------------------------------------------------------------------------------------------

describe('MonthlyPlanPageComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'monthly-plans/:year/:month/spending', children: [] },
          { path: 'monthly-plans/:year/:month', component: MonthlyPlanPageComponent },
          { path: 'monthly-planning', children: [] },
          { path: 'expenses/new', children: [] }
        ]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  describe('loading (TC_F2_001)', () => {
    it('sends exactly one GET for the route period and nothing else', async () => {
      const page = await createPage();

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.method).toBe('GET');
      expect(request.request.body).toBeNull();

      request.flush(MONTHLY_PLAN_FIXTURE);
    });

    it('shows a polite loading status under the page title, and no amounts or placeholders', async () => {
      const page = await createPage();

      const status = el(page.root, '[role=status]');
      expect(text(status)).toBe(LOADING);
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expect(alerts(page)).toHaveLength(0);
      expect(buttons(page)).toHaveLength(0);
      expectNoAmounts(page);

      page.http.expectOne(SEPTEMBER).flush(MONTHLY_PLAN_FIXTURE);
    });

    it('replaces the loading message when the plan arrives', async () => {
      const page = await createPage();

      await answer(page, ok(MONTHLY_PLAN_FIXTURE));

      expect(text(page.root)).not.toContain(LOADING);
      expect(page.root.querySelector('[role=status]')).toBeNull();
    });
  });

  describe('ready (TC_F2_001, TC_F2_002, AC1, AC2)', () => {
    it('shows the title, the period label and the formatted income', async () => {
      const page = await readyPage();

      expect(headings(page, 'h1')).toEqual([TITLE]);
      expect(headings(page, 'h2')).toEqual(['Total monthly income', 'The Seven Jars']);
      expect(text(el(page.root, '.income-value'))).toBe('25,000,000 VND');
      expect(text(el(page.root, '.income-meta'))).toBe('Monthly plan for September 2026');
      expect(text(page.root)).toContain('Your income is allocated to 7 jars based on the default rates.');
      expect(alerts(page)).toHaveLength(0);
      expect(page.root.querySelector('[role=status]')).toBeNull();
    });

    it('renders seven jar cards in response order with name, rate and formatted budget', async () => {
      const page = await readyPage();

      expect(jarCards(page)).toEqual(CANONICAL_CARDS);
      expect(headings(page, 'h3')).toEqual(CANONICAL_CARDS.map((card) => card.name));
    });

    it('lists the same jars and rates in the legend, in response order', async () => {
      const page = await readyPage();

      expect(legendItems(page)).toEqual(CANONICAL_CARDS.map((card) => `${card.name} ${card.rate}`));
    });

    it('renders the response order of a non-canonical plan and never sorts (reversed jars)', async () => {
      const page = await readyPage(NON_CANONICAL_MONTHLY_PLAN_FIXTURE);

      const reversed = [...CANONICAL_CARDS].reverse();
      expect(jarCards(page)).toEqual(reversed);
      expect(legendItems(page)).toEqual(reversed.map((card) => `${card.name} ${card.rate}`));
    });

    it('draws one donut slice per jar from the backend percentage, with a cumulative offset', async () => {
      const page = await readyPage();

      const circles = donutCircles(page);
      expect(circles).toHaveLength(7);
      expect(circles.map((circle) => circle.getAttribute('stroke-dasharray'))).toEqual(
        CANONICAL_DONUT.map((slice) => slice.dash)
      );
      expect(circles.map((circle) => circle.getAttribute('stroke-dashoffset'))).toEqual(
        CANONICAL_DONUT.map((slice) => slice.offset)
      );
      expect(circles.every((circle) => circle.getAttribute('pathLength') === '100')).toBe(true);
      expect(text(el(page.root, '.donut-label'))).toBe('7 jars');
    });

    it('colours each slice by jar type and lays the donut out in response order', async () => {
      const page = await readyPage(NON_CANONICAL_MONTHLY_PLAN_FIXTURE);

      const circles = donutCircles(page);
      expect(circles.map((circle) => circle.getAttribute('stroke-dasharray'))).toEqual(
        REVERSED_DONUT.map((slice) => slice.dash)
      );
      expect(circles.map((circle) => circle.getAttribute('stroke-dashoffset'))).toEqual(
        REVERSED_DONUT.map((slice) => slice.offset)
      );
      expect(circles[0].getAttribute('stroke')).toBe(jarColor('entertainmentAndTravel'));
      expect(circles[6].getAttribute('stroke')).toBe(jarColor('livingExpenses'));
    });

    it('does not claim the plan is "100% allocated" or show any computed total', async () => {
      const page = await readyPage();

      const content = text(page.root);
      expect(content).not.toMatch(/100\s*%\s*allocated/i);
      expect(content).not.toMatch(/allocated\s*100/i);
      expect(content).not.toMatch(/total allocated/i);
      expect(content.match(/VND/g)).toHaveLength(8);
    });

    it('shows backend values as returned: names, rates, remainder-style budgets and donut come from the response (TC_F2_002, TC_F2_003)', async () => {
      const page = await readyPage(OCTOBER_PLAN, '/monthly-plans/2026/10', OCTOBER);

      expect(text(el(page.root, '.income-value'))).toBe('10,000,003 VND');
      expect(jarCards(page)).toEqual(OCTOBER_CARDS);
      expect(donutCircles(page).map((circle) => circle.getAttribute('stroke-dasharray'))).toEqual([
        '40 100',
        '25 100',
        '10 100',
        '10 100',
        '5 100',
        '5 100',
        '5 100'
      ]);
      expect(donutCircles(page).map((circle) => circle.getAttribute('stroke-dashoffset'))).toEqual([
        '0',
        '-40',
        '-65',
        '-75',
        '-85',
        '-90',
        '-95'
      ]);
    });

    it('formats amounts above 2^53 exactly (no floating point on money)', async () => {
      const big = {
        ...MONTHLY_PLAN_FIXTURE,
        monthlyIncomeVnd: '9007199254740993',
        jars: [{ ...JARS[0], budgetVnd: '9007199254740993' }, ...JARS.slice(1)]
      };

      const page = await readyPage(big);

      expect(text(el(page.root, '.income-value'))).toBe('9,007,199,254,740,993 VND');
      expect(jarCards(page)[0].budget).toBe('9,007,199,254,740,993 VND');
    });

    it('hides decorative svg and the donut from assistive technology', async () => {
      const page = await readyPage();

      expect(el(page.root, '.donut').getAttribute('aria-hidden')).toBe('true');
      const svgs = els(page.root, 'svg');
      expect(svgs.length).toBeGreaterThan(0);
      expect(svgs.every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
      expect(el(page.root, 'ul[aria-label="Jar allocation legend"]')).toBeTruthy();
    });
  });

  describe('navigation links', () => {
    it('links back to monthly planning', async () => {
      const page = await readyPage();

      const back = link(page, 'Back to monthly planning');
      expect(back.getAttribute('href')).toBe('/monthly-planning');
      expect(el(back, 'span').getAttribute('aria-hidden')).toBe('true');
    });

    it('links to the spending page of the viewed period', async () => {
      const page = await readyPage();

      expect(link(page, 'View spending').getAttribute('href')).toBe('/monthly-plans/2026/9/spending');
    });

    it('links to add expense pre-filled with the first day of the viewed month', async () => {
      const page = await readyPage();

      expect(link(page, 'Add expense').getAttribute('href')).toBe('/expenses/new?expenseDate=2026-09-01');
    });

    it('navigates to the target route when a link is clicked', async () => {
      const page = await readyPage();

      link(page, 'View spending').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2026/9/spending');
    });

    it('navigates to monthly planning from the back link', async () => {
      const page = await readyPage();

      link(page, 'Back to monthly planning').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-planning');
    });

    it('offers back navigation while loading and offers no spending or expense links yet', async () => {
      const page = await createPage();

      expect(link(page, 'Back to monthly planning').getAttribute('href')).toBe('/monthly-planning');
      expect(hasLink(page, 'View spending')).toBe(false);
      expect(hasLink(page, 'Add expense')).toBe(false);

      page.http.expectOne(SEPTEMBER).flush(MONTHLY_PLAN_FIXTURE);
    });

    it('offers no spending or expense links when the plan could not be shown', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      expect(link(page, 'Back to monthly planning').getAttribute('href')).toBe('/monthly-planning');
      expect(hasLink(page, 'View spending')).toBe(false);
      expect(hasLink(page, 'Add expense')).toBe(false);
    });

    it.each([
      ['/monthly-plans/9999/12', 9999, 12, 'December 9999', '9999-12-01'],
      ['/monthly-plans/2026/09', 2026, 9, 'September 2026', '2026-09-01'],
      ['/monthly-plans/1/1', 1, 1, 'January 1', '0001-01-01']
    ])('accepts %s as a valid period', async (url, year, month, label, expenseDate) => {
      const page = await readyPage({ ...MONTHLY_PLAN_FIXTURE, year, month }, url, BY_PERIOD(year, month));

      expect(text(el(page.root, '.income-meta'))).toBe(`Monthly plan for ${label}`);
      expect(link(page, 'View spending').getAttribute('href')).toBe(`/monthly-plans/${year}/${month}/spending`);
      expect(link(page, 'Add expense').getAttribute('href')).toBe(`/expenses/new?expenseDate=${expenseDate}`);
    });

    it('requests the normalised period when a segment has a leading zero', async () => {
      const page = await createPage('/monthly-plans/2026/09');

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.url).toBe(BY_PERIOD(2026, 9));

      request.flush(MONTHLY_PLAN_FIXTURE);
    });
  });

  describe('plan not found (TC_F2_001, AC3)', () => {
    it('shows "Monthly plan unavailable" and a Create a plan link, with no amounts', async () => {
      const page = await failedPage(fail(404, 'Not Found', NOT_FOUND_ERROR_FIXTURE));

      expect(headings(page, 'h1')).toEqual([NOT_FOUND_TITLE]);
      expect(text(el(page.root, '.state-period'))).toBe('September 2026');
      expect(text(page.root)).toContain('There is no monthly plan for this period yet.');
      expect(link(page, 'Create a plan').getAttribute('href')).toBe('/monthly-planning');
      expect(alerts(page)).toHaveLength(1);
      expect(text(alerts(page)[0])).toContain(NOT_FOUND_TITLE);
      expectNoAmounts(page);
    });

    it('offers no retry, no spending link and no add-expense link', async () => {
      const page = await failedPage(fail(404, 'Not Found', NOT_FOUND_ERROR_FIXTURE));

      expect(buttons(page)).toHaveLength(0);
      expect(hasLink(page, 'View spending')).toBe(false);
      expect(hasLink(page, 'Add expense')).toBe(false);
      expect(text(page.root)).not.toContain(LOAD_FAILED);
    });

    it('navigates to monthly planning from Create a plan', async () => {
      const page = await failedPage(fail(404, 'Not Found', NOT_FOUND_ERROR_FIXTURE));

      link(page, 'Create a plan').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-planning');
    });

    it.each([
      ['an empty object', {}],
      ['an envelope with another code', { code: 'SOMETHING_ELSE', message: 'Not here.', errors: [] }],
      ['a plain-text body', 'Not Found']
    ] as [string, Body][])(
      'treats a 404 with %s as a generic load error, not as a missing plan',
      async (_label, body) => {
        const page = await failedPage(fail(404, 'Not Found', body));

        expect(headings(page, 'h1')).toEqual([TITLE]);
        expect(text(page.root)).not.toContain(NOT_FOUND_TITLE);
        expect(hasLink(page, 'Create a plan')).toBe(false);
        expect(text(el(page.root, '[role=alert]'))).toContain(LOAD_FAILED);
        expect(retryButton(page).type).toBe('button');
        expectNoAmounts(page);
      }
    );
  });

  describe('load failures and retry', () => {
    it('shows the generic message, never the raw server message, for a 500', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      expect(alerts(page)).toHaveLength(1);
      expect(text(alerts(page)[0])).toContain(LOAD_FAILED);
      expect(text(page.root)).not.toContain(INTERNAL_ERROR_FIXTURE.message);
      expect(text(page.root)).not.toContain('stack trace');
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expectNoAmounts(page);
    });

    it('shows the generic message for a non-JSON 503', async () => {
      const page = await failedPage(fail(503, 'Service Unavailable', '<html>upstream down</html>'));

      expect(text(el(page.root, '[role=alert]'))).toContain(LOAD_FAILED);
      expect(text(page.root)).not.toContain('upstream down');
      expect(retryButton(page)).toBeTruthy();
    });

    it('shows the network message with a retry button when the server is unreachable', async () => {
      const page = await failedPage(NETWORK_FAILURE);

      expect(text(el(page.root, '[role=alert]'))).toContain(NETWORK_FAILED);
      expect(retryButton(page).type).toBe('button');
      expectNoAmounts(page);
    });

    it('re-issues exactly one GET on Try again, shows loading meanwhile, then renders the plan', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      retryButton(page).click();
      render(page);

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.method).toBe('GET');
      expect(text(el(page.root, '[role=status]'))).toBe(LOADING);
      expect(alerts(page)).toHaveLength(0);
      expect(buttons(page)).toHaveLength(0);
      expectNoAmounts(page);

      request.flush(MONTHLY_PLAN_FIXTURE);
      await settle(page);

      expectReady(page);
      expect(jarCards(page)).toEqual(CANONICAL_CARDS);
      expect(text(page.root)).not.toContain(LOAD_FAILED);
    });

    it('retries after a network error and renders the plan', async () => {
      const page = await failedPage(NETWORK_FAILURE);

      retryButton(page).click();
      render(page);
      await answer(page, ok(MONTHLY_PLAN_FIXTURE));

      expectReady(page);
      expect(text(page.root)).not.toContain(NETWORK_FAILED);
    });

    it('stays in the error state when the retry fails too, and can be retried again', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      retryButton(page).click();
      render(page);
      await answer(page, NETWORK_FAILURE);

      expect(text(el(page.root, '[role=alert]'))).toContain(NETWORK_FAILED);

      retryButton(page).click();
      render(page);
      await answer(page, ok(MONTHLY_PLAN_FIXTURE));

      expectReady(page);
    });

    it('keeps a single live request when Try again is clicked twice before the view updates', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));
      const button = retryButton(page);

      button.click();
      button.click();
      render(page);

      const live = page.http.match(SEPTEMBER).filter((request) => !request.cancelled);
      expect(live).toHaveLength(1);

      live[0].flush(MONTHLY_PLAN_FIXTURE);
      await settle(page);
      expectReady(page);
    });
  });

  describe('malformed 200 responses', () => {
    it.each(MALFORMED_PLANS)('shows a data-integrity error and no amounts for %s', async (_label, body) => {
      const page = await readyPage(body);

      expect(alerts(page)).toHaveLength(1);
      expect(text(alerts(page)[0])).toContain(INTEGRITY_FAILED);
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expect(retryButton(page).type).toBe('button');
      expectNoAmounts(page);
    });

    it('does not show the integrity error for a well-formed plan', async () => {
      const page = await readyPage();

      expect(text(page.root)).not.toContain(INTEGRITY_FAILED);
    });

    it('retries a malformed response and renders the corrected plan', async () => {
      const page = await readyPage({ ...MONTHLY_PLAN_FIXTURE, jars: JARS.slice(0, 6) });

      retryButton(page).click();
      render(page);
      await answer(page, ok(MONTHLY_PLAN_FIXTURE));

      expectReady(page);
      expect(jarCards(page)).toEqual(CANONICAL_CARDS);
      expect(text(page.root)).not.toContain(INTEGRITY_FAILED);
    });
  });

  describe('invalid route params', () => {
    it.each(INVALID_ROUTES)('%s makes no HTTP call and shows the invalid-period alert with a way back', async (url) => {
      const page = await createPage(url);
      await settle(page);

      page.http.expectNone(() => true);
      expect(alerts(page)).toHaveLength(1);
      expect(text(alerts(page)[0])).toContain(INVALID_PERIOD);
      expect(link(page, 'Back to monthly planning').getAttribute('href')).toBe('/monthly-planning');
      expect(els(page.root, 'a')).toHaveLength(1);
      expect(buttons(page)).toHaveLength(0);
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expect(page.root.querySelector('[role=status]')).toBeNull();
      expectNoAmounts(page);
    });

    it('lands in the same state when the server answers 400', async () => {
      const page = await failedPage(fail(400, 'Bad Request', VALIDATION_ERROR_FIXTURE));

      expect(text(el(page.root, '[role=alert]'))).toContain(INVALID_PERIOD);
      expect(text(page.root)).not.toContain(VALIDATION_ERROR_FIXTURE.message);
      expect(els(page.root, 'a')).toHaveLength(1);
      expect(buttons(page)).toHaveLength(0);
      expectNoAmounts(page);
    });

    it('shows the retryable error state for a 400 that is not a VALIDATION_ERROR envelope', async () => {
      const page = await failedPage(fail(400, 'Bad Request', {}));

      expect(text(el(page.root, '[role=alert]'))).toContain(LOAD_FAILED);
      expect(text(page.root)).not.toContain(INVALID_PERIOD);
      expect(retryButton(page).type).toBe('button');
      expectNoAmounts(page);
    });

    it('navigates to monthly planning from the back link', async () => {
      const page = await createPage('/monthly-plans/abc/9');

      link(page, 'Back to monthly planning').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-planning');
    });
  });

  describe('route param changes', () => {
    it('reloads on the same component instance and updates the period, amounts and links', async () => {
      const page = await readyPage();
      expect(text(el(page.root, '.income-meta'))).toBe('Monthly plan for September 2026');

      const next = await page.harness.navigateByUrl('/monthly-plans/2026/10', MonthlyPlanPageComponent);
      render(page);

      expect(next).toBe(page.component);
      // loading again: the September numbers must be gone while October is in flight
      expect(text(el(page.root, '[role=status]'))).toBe(LOADING);
      expectNoAmounts(page);
      const request = page.http.expectOne(OCTOBER);
      expect(request.request.method).toBe('GET');

      request.flush(OCTOBER_PLAN);
      await settle(page);

      expect(text(el(page.root, '.income-meta'))).toBe('Monthly plan for October 2026');
      expect(text(el(page.root, '.income-value'))).toBe('10,000,003 VND');
      expect(jarCards(page)).toEqual(OCTOBER_CARDS);
      expect(link(page, 'View spending').getAttribute('href')).toBe('/monthly-plans/2026/10/spending');
      expect(link(page, 'Add expense').getAttribute('href')).toBe('/expenses/new?expenseDate=2026-10-01');
    });

    it('cancels the in-flight GET of the previous period, so its late response cannot be delivered', async () => {
      const page = await createPage();
      const stale = page.http.expectOne(SEPTEMBER);

      await page.harness.navigateByUrl('/monthly-plans/2026/10', MonthlyPlanPageComponent);
      render(page);
      const fresh = page.http.expectOne(OCTOBER);

      expect(stale.cancelled).toBe(true);
      expect(fresh.cancelled).toBe(false);
      expect(() => stale.flush(MONTHLY_PLAN_FIXTURE)).toThrow(/cancelled/i);
      render(page);
      expect(text(el(page.root, '[role=status]'))).toBe(LOADING);
      expectNoAmounts(page);

      fresh.flush(OCTOBER_PLAN);
      await settle(page);

      expect(text(el(page.root, '.income-meta'))).toBe('Monthly plan for October 2026');
      expect(text(el(page.root, '.income-value'))).toBe('10,000,003 VND');
      expect(text(page.root)).not.toContain('25,000,000');
    });

    it('ignores a response for the previous period that arrives after the new request started', async () => {
      const responses = new Map<string, Subject<MonthlyPlanResponse>>();
      vi.spyOn(TestBed.inject(BudgetPlanApiService), 'getMonthlyPlan').mockImplementation((year, month) => {
        const subject = new Subject<MonthlyPlanResponse>();
        responses.set(`${year}/${month}`, subject);
        return subject;
      });
      const subjectFor = (key: string): Subject<MonthlyPlanResponse> => {
        const subject = responses.get(key);
        if (!subject) {
          throw new Error(`No request was made for ${key}`);
        }
        return subject;
      };
      const page = await createPage('/monthly-plans/2026/9');

      await page.harness.navigateByUrl('/monthly-plans/2026/10', MonthlyPlanPageComponent);
      render(page);
      expect([...responses.keys()]).toEqual(['2026/9', '2026/10']);

      subjectFor('2026/9').next(MONTHLY_PLAN_FIXTURE);
      await settle(page);

      expect(text(el(page.root, '[role=status]'))).toBe(LOADING);
      expectNoAmounts(page);

      subjectFor('2026/10').next(OCTOBER_PLAN);
      await settle(page);

      expect(text(el(page.root, '.income-meta'))).toBe('Monthly plan for October 2026');
      expect(text(el(page.root, '.income-value'))).toBe('10,000,003 VND');

      // a straggler for September after October is already shown still changes nothing
      subjectFor('2026/9').next(MONTHLY_PLAN_FIXTURE);
      await settle(page);

      expect(text(el(page.root, '.income-meta'))).toBe('Monthly plan for October 2026');
      expect(text(page.root)).not.toContain('25,000,000');
    });

    it('does not keep the previous period amounts when the next period has no plan', async () => {
      const page = await readyPage();

      await page.harness.navigateByUrl('/monthly-plans/2026/10', MonthlyPlanPageComponent);
      render(page);
      await answer(page, fail(404, 'Not Found', NOT_FOUND_ERROR_FIXTURE), OCTOBER);

      expect(headings(page, 'h1')).toEqual([NOT_FOUND_TITLE]);
      expect(text(el(page.root, '.state-period'))).toBe('October 2026');
      expectNoAmounts(page);
    });

    it('does not keep the previous period amounts when the next period is invalid, and issues no request', async () => {
      const page = await readyPage();

      await page.harness.navigateByUrl('/monthly-plans/2026/13', MonthlyPlanPageComponent);
      render(page);

      page.http.expectNone(() => true);
      expect(text(el(page.root, '[role=alert]'))).toContain(INVALID_PERIOD);
      expectNoAmounts(page);
    });

    it('recovers from an invalid period when the route becomes valid again', async () => {
      const page = await createPage('/monthly-plans/abc/9');

      await page.harness.navigateByUrl('/monthly-plans/2026/9', MonthlyPlanPageComponent);
      render(page);
      await answer(page, ok(MONTHLY_PLAN_FIXTURE));

      expectReady(page);
      expect(jarCards(page)).toEqual(CANONICAL_CARDS);
    });

    it('retries the period that is currently in the route after a param change', async () => {
      const page = await readyPage();

      await page.harness.navigateByUrl('/monthly-plans/2026/10', MonthlyPlanPageComponent);
      render(page);
      await answer(page, fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE), OCTOBER);

      retryButton(page).click();
      render(page);
      page.http.expectNone(SEPTEMBER);
      await answer(page, ok(OCTOBER_PLAN), OCTOBER);

      expect(text(el(page.root, '.income-meta'))).toBe('Monthly plan for October 2026');
      expect(jarCards(page)).toEqual(OCTOBER_CARDS);
    });
  });

  describe('accessibility', () => {
    interface StateCase {
      name: string;
      url: string;
      /** `null`: the GET stays pending (loading) or is never sent (invalid period). */
      respond: Respond | null;
      requested: boolean;
      title: string;
      alerts: number;
    }

    const STATES: StateCase[] = [
      { name: 'loading', url: '/monthly-plans/2026/9', respond: null, requested: true, title: TITLE, alerts: 0 },
      {
        name: 'ready',
        url: '/monthly-plans/2026/9',
        respond: ok(MONTHLY_PLAN_FIXTURE),
        requested: true,
        title: TITLE,
        alerts: 0
      },
      {
        name: 'not-found',
        url: '/monthly-plans/2026/9',
        respond: fail(404, 'Not Found', NOT_FOUND_ERROR_FIXTURE),
        requested: true,
        title: NOT_FOUND_TITLE,
        alerts: 1
      },
      {
        name: 'error',
        url: '/monthly-plans/2026/9',
        respond: fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE),
        requested: true,
        title: TITLE,
        alerts: 1
      },
      {
        name: 'malformed',
        url: '/monthly-plans/2026/9',
        respond: ok({ ...MONTHLY_PLAN_FIXTURE, currency: 'USD' }),
        requested: true,
        title: TITLE,
        alerts: 1
      },
      { name: 'invalid-period', url: '/monthly-plans/abc/9', respond: null, requested: false, title: TITLE, alerts: 1 }
    ];

    const openState = async (state: StateCase): Promise<Page> => {
      const page = await createPage(state.url);
      if (state.requested) {
        const request = page.http.expectOne(SEPTEMBER);
        if (state.respond) {
          state.respond(request);
          await settle(page);
        }
      }
      return page;
    };

    it.each(STATES)('$name state has a single h1, the right alerts, typed buttons and hidden svg', async (state) => {
      const page = await openState(state);

      expect(headings(page, 'h1')).toEqual([state.title]);
      expect(alerts(page)).toHaveLength(state.alerts);
      expect(buttons(page).every((button) => button.getAttribute('type') === 'button')).toBe(true);
      expect(els(page.root, 'svg').every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
    });

    it.each(STATES.filter((state) => state.alerts === 1))(
      '$name state announces itself with an alert that is named by or contains its message',
      async (state) => {
        const page = await openState(state);

        const alert = el(page.root, '[role=alert]');
        const labelledBy = alert.getAttribute('aria-labelledby');
        if (labelledBy) {
          expect(text(el(page.root, `#${labelledBy}`))).toBe(state.title);
        } else {
          expect(text(alert).length).toBeGreaterThan(0);
        }
        // the decorative "!" icon is hidden from assistive technology
        expect(el(alert, '.state-icon').getAttribute('aria-hidden')).toBe('true');
      }
    );

    it('names the ready sections by their headings', async () => {
      const page = await readyPage();

      expect(text(el(page.root, `#${el(page.root, 'section.plan-content').getAttribute('aria-labelledby')}`))).toBe(
        TITLE
      );
      expect(text(el(page.root, '#summary-heading'))).toBe('Total monthly income');
      expect(text(el(page.root, '#jars-heading'))).toBe('The Seven Jars');
    });
  });
});
