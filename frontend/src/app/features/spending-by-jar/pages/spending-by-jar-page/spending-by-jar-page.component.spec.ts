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
import { SpendingByJar, SpendingByJarsResponse } from '../../../../models/budget-plan.models';
import { jarColor } from '../../../../shared/constants/jar-colors';
import {
  INTERNAL_ERROR_FIXTURE,
  NON_CANONICAL_SPENDING_BY_JARS_FIXTURE,
  NOT_FOUND_ERROR_FIXTURE,
  OCTOBER_SPENDING_BY_JARS_FIXTURE,
  SPENDING_BY_JARS_FIXTURE,
  VALIDATION_ERROR_FIXTURE
} from '../../../../testing/fixtures';
import { SpendingByJarPageComponent } from './spending-by-jar-page.component';

const { SPENDING_BY_JARS } = BUDGET_PLAN_ENDPOINTS;

const SEPTEMBER = SPENDING_BY_JARS(2026, 9);
const OCTOBER = SPENDING_BY_JARS(2026, 10);
const SEPTEMBER_URL = '/monthly-plans/2026/9/spending';
const OCTOBER_URL = '/monthly-plans/2026/10/spending';

const TITLE = 'Spending by jar';
const LOADING = 'Loading spending by jar…';
const SEPTEMBER_META = 'September 2026 · Amounts in VND';
const OCTOBER_META = 'October 2026 · Amounts in VND';
const NOT_FOUND = 'There is no monthly plan for this period yet.';
const LOAD_FAILED = 'We could not load the spending by jar. Please try again.';
const INTEGRITY_FAILED = 'The spending data is incomplete or invalid. Please try again.';
const NETWORK_FAILED = 'We could not reach the server. Check your connection and try again.';
const INVALID_PERIOD = 'This spending link is not valid. Choose a month from monthly planning.';

const OVER_BUDGET = 'Over budget';

interface RowSnapshot {
  name: string;
  percent: string;
  amount: string;
  badge: string | null;
}

interface BarSnapshot {
  now: string | null;
  width: string;
  label: string | null;
  valueText: string | null;
}

/** What the user sees for `SPENDING_BY_JARS_FIXTURE`, in response order. */
const CANONICAL_ROWS: RowSnapshot[] = [
  { name: 'Living Expenses', percent: '50%', amount: '4,375,000 VND / 8,750,000 VND', badge: null },
  { name: 'Food', percent: '0%', amount: '0 VND / 5,000,000 VND', badge: null },
  { name: 'Children', percent: '25%', amount: '625,000 VND / 2,500,000 VND', badge: null },
  { name: 'Emergency Fund', percent: '0%', amount: '0 VND / 2,500,000 VND', badge: null },
  { name: 'Savings', percent: '100%', amount: '2,500,000 VND / 2,500,000 VND', badge: null },
  { name: 'Investment', percent: '125.5%', amount: '3,137,500 VND / 2,500,000 VND', badge: OVER_BUDGET },
  { name: 'Entertainment & Travel', percent: '33.33%', amount: '416,667 VND / 1,250,000 VND', badge: null }
];

const CANONICAL_BARS: BarSnapshot[] = [
  {
    now: '50',
    width: '50%',
    label: 'Living Expenses: spent 4,375,000 VND of 8,750,000 VND, 50% used',
    valueText: '50% used'
  },
  { now: '0', width: '0%', label: 'Food: spent 0 VND of 5,000,000 VND, 0% used', valueText: '0% used' },
  {
    now: '25',
    width: '25%',
    label: 'Children: spent 625,000 VND of 2,500,000 VND, 25% used',
    valueText: '25% used'
  },
  {
    now: '0',
    width: '0%',
    label: 'Emergency Fund: spent 0 VND of 2,500,000 VND, 0% used',
    valueText: '0% used'
  },
  {
    now: '100',
    width: '100%',
    label: 'Savings: spent 2,500,000 VND of 2,500,000 VND, 100% used',
    valueText: '100% used'
  },
  {
    now: '100',
    width: '100%',
    label: 'Investment: spent 3,137,500 VND of 2,500,000 VND, 125.5% used, over budget',
    valueText: '125.5% used, over budget'
  },
  {
    now: '33.33',
    width: '33.33%',
    label: 'Entertainment & Travel: spent 416,667 VND of 1,250,000 VND, 33.33% used',
    valueText: '33.33% used'
  }
];

const JARS = SPENDING_BY_JARS_FIXTURE.jars;
const withJars = (jars: object[]): object => ({ ...SPENDING_BY_JARS_FIXTURE, jars });
const patchJar = (index: number, patch: Partial<Record<keyof SpendingByJar, unknown>>): object[] =>
  JARS.map((jar, i) => (i === index ? { ...jar, ...patch } : jar));

/** 200 bodies that fail the integrity check. `flush` takes any object, so no cast is needed. */
const MALFORMED_SPENDING: [string, object | null][] = [
  ['six jars', withJars(JARS.slice(0, 6))],
  ['eight jars', withJars([...JARS, JARS[0]])],
  ['no jars at all', withJars([])],
  ['duplicate jar types', withJars([...JARS.slice(0, 6), JARS[1]])],
  ['unknown jar type', withJars(patchJar(0, { jarType: 'luxury' }))],
  ['USD currency', { ...SPENDING_BY_JARS_FIXTURE, currency: 'USD' }],
  ['planned budget with grouping separators', withJars(patchJar(0, { plannedBudgetVnd: '8,750,000' }))],
  ['planned budget with a decimal part', withJars(patchJar(0, { plannedBudgetVnd: '8750000.5' }))],
  ['spent amount with letters', withJars(patchJar(0, { spentBudgetVnd: '4.3M' }))],
  ['negative spent amount', withJars(patchJar(0, { spentBudgetVnd: '-1' }))],
  ['spent amount that is a number, not a string', withJars(patchJar(0, { spentBudgetVnd: 4375000 }))],
  ['percentage that is a string', withJars(patchJar(0, { percentageUsed: '50' }))],
  ['negative percentage', withJars(patchJar(0, { percentageUsed: -1 }))],
  ['jar name that is not a string', withJars(patchJar(0, { jarName: 7 }))],
  ['jars missing', { ...SPENDING_BY_JARS_FIXTURE, jars: undefined }],
  ['a body for another month than the route', { ...SPENDING_BY_JARS_FIXTURE, month: 10 }],
  ['a body for another year than the route', { ...SPENDING_BY_JARS_FIXTURE, year: 2025 }],
  ['empty body', null]
];

const INVALID_ROUTES = [
  '/monthly-plans/abc/9/spending',
  '/monthly-plans/2026/13/spending',
  '/monthly-plans/2026/0/spending',
  '/monthly-plans/0/1/spending',
  '/monthly-plans/2026/1.5/spending',
  '/monthly-plans/10000/1/spending',
  '/monthly-plans/2026/abc/spending',
  '/monthly-plans/-1/5/spending'
];

type Body = object | string | null;
type Respond = (request: TestRequest) => void;

interface Page {
  harness: RouterTestingHarness;
  component: SpendingByJarPageComponent;
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
const anchors = (page: Page): HTMLAnchorElement[] => els<HTMLAnchorElement>(page.root, 'a');
const meta = (page: Page): string => text(page.root.querySelector('.spending-meta'));

const link = (page: Page, label: string): HTMLAnchorElement => {
  const found = anchors(page).find((anchor) => text(anchor).includes(label));
  if (!found) {
    throw new Error(`Link not found: ${label}`);
  }
  return found;
};

const hasLink = (page: Page, label: string): boolean => anchors(page).some((anchor) => text(anchor).includes(label));

const retryButton = (page: Page): HTMLButtonElement => {
  const found = buttons(page).find((button) => text(button) === 'Try again');
  if (!found) {
    throw new Error('Try again button not found');
  }
  return found;
};

const jarItems = (page: Page): HTMLElement[] => els(page.root, 'ul[aria-label="Spending by jar"] > li');

const rowSnapshots = (page: Page): RowSnapshot[] =>
  jarItems(page).map((item) => ({
    name: text(el(item, '.jar-name')),
    percent: text(el(item, '.jar-percent')),
    amount: text(el(item, '.jar-amount')),
    badge: item.querySelector('.over-badge') === null ? null : text(el(item, '.over-badge'))
  }));

const barSnapshots = (page: Page): BarSnapshot[] =>
  els(page.root, '[role=progressbar]').map((bar) => ({
    now: bar.getAttribute('aria-valuenow'),
    width: el(bar, '.progress-fill').style.width,
    label: bar.getAttribute('aria-label'),
    valueText: bar.getAttribute('aria-valuetext')
  }));

/** The one row whose jar name matches, as the user reads it. */
const rowFor = (page: Page, name: string): HTMLElement => {
  const found = jarItems(page).find((item) => text(el(item, '.jar-name')) === name);
  if (!found) {
    throw new Error(`Row not found: ${name}`);
  }
  return found;
};

/** Runs change detection after a synchronous user action. */
const render = (page: Page): void => page.harness.detectChanges();

/** Waits for pending async work (router navigation, microtasks). Only call it when no HTTP request is outstanding. */
const settle = async (page: Page): Promise<void> => {
  await TestBed.inject(ApplicationRef).whenStable();
  render(page);
};

const createPage = async (url = SEPTEMBER_URL): Promise<Page> => {
  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(url, SpendingByJarPageComponent);
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
  body: Body = SPENDING_BY_JARS_FIXTURE,
  url = SEPTEMBER_URL,
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

/** No jar row, progress bar, percentage or amount may be on screen. */
const expectNoAmounts = (page: Page): void => {
  const content = text(page.root);
  expect(content).not.toMatch(/\d,\d{3}/);
  expect(content).not.toContain('%');
  expect(content).not.toContain(OVER_BUDGET);
  expect(page.root.querySelector('[role=progressbar]')).toBeNull();
  expect(jarItems(page)).toHaveLength(0);
};

const expectReady = (page: Page): void => {
  expect(headings(page, 'h1')).toEqual([TITLE]);
  expect(jarItems(page)).toHaveLength(7);
  expect(alerts(page)).toHaveLength(0);
  expect(page.root.querySelector('[role=status]')).toBeNull();
};

// ---------------------------------------------------------------------------------------------------------------------

describe('SpendingByJarPageComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'monthly-plans/:year/:month/spending', component: SpendingByJarPageComponent },
          { path: 'monthly-plans/:year/:month', children: [] },
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

  describe('loading', () => {
    it('sends exactly one GET for the route period, never one request per jar', async () => {
      const page = await createPage();

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.method).toBe('GET');
      expect(request.request.body).toBeNull();
      page.http.expectNone(() => true);

      request.flush(SPENDING_BY_JARS_FIXTURE);
      await settle(page);

      page.http.expectNone(() => true);
      expect(jarItems(page)).toHaveLength(7);
    });

    it('shows a polite status under the title and the period, and no amounts', async () => {
      const page = await createPage();

      const status = el(page.root, '[role=status]');
      expect(text(status)).toBe(LOADING);
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expect(meta(page)).toBe(SEPTEMBER_META);
      expect(alerts(page)).toHaveLength(0);
      expect(buttons(page)).toHaveLength(0);
      expectNoAmounts(page);

      page.http.expectOne(SEPTEMBER).flush(SPENDING_BY_JARS_FIXTURE);
    });

    it('reserves seven skeleton rows and hides them from assistive technology', async () => {
      const page = await createPage();

      const skeleton = el(page.root, '.jar-list');
      expect(skeleton.getAttribute('aria-hidden')).toBe('true');
      expect(els(skeleton, ':scope > .jar-row')).toHaveLength(7);
      expect(text(skeleton)).toBe('');

      page.http.expectOne(SEPTEMBER).flush(SPENDING_BY_JARS_FIXTURE);
    });

    it('replaces the status and the skeleton when the data arrives', async () => {
      const page = await createPage();

      await answer(page, ok(SPENDING_BY_JARS_FIXTURE));

      expect(text(page.root)).not.toContain(LOADING);
      expect(page.root.querySelector('[role=status]')).toBeNull();
      expect(page.root.querySelector('.skeleton')).toBeNull();
      expectReady(page);
    });
  });

  describe('ready', () => {
    it('shows the title, the period context and the VND unit', async () => {
      const page = await readyPage();

      expectReady(page);
      expect(meta(page)).toBe(SEPTEMBER_META);
    });

    it('renders seven rows in response order with name, spent / planned and the backend percentage', async () => {
      const page = await readyPage();

      expect(rowSnapshots(page)).toEqual(CANONICAL_ROWS);
    });

    it('renders the response order of a non-canonical response and never sorts (reversed jars)', async () => {
      const page = await readyPage(NON_CANONICAL_SPENDING_BY_JARS_FIXTURE);

      expect(rowSnapshots(page)).toEqual([...CANONICAL_ROWS].reverse());
      expect(rowSnapshots(page)[0].name).toBe('Entertainment & Travel');
      expect(barSnapshots(page)).toEqual([...CANONICAL_BARS].reverse());
    });

    it('shows backend percentages as returned: 125.5%, 33.33% and 0% are never clamped or recomputed', async () => {
      const page = await readyPage();

      expect(text(el(rowFor(page, 'Investment'), '.jar-percent'))).toBe('125.5%');
      expect(text(el(rowFor(page, 'Entertainment & Travel'), '.jar-percent'))).toBe('33.33%');
      expect(text(el(rowFor(page, 'Food'), '.jar-percent'))).toBe('0%');
      expect(text(page.root)).not.toContain('100.5%');
    });

    it('shows at most two decimals for a percentage', async () => {
      const page = await readyPage(withJars(patchJar(0, { percentageUsed: 33.3333 })));

      expect(text(el(rowFor(page, 'Living Expenses'), '.jar-percent'))).toBe('33.33%');
    });

    it('formats amounts above 2^53 exactly (no floating point on money)', async () => {
      const page = await readyPage(
        withJars(patchJar(0, { spentBudgetVnd: '9007199254740993', plannedBudgetVnd: '9007199254740993123' }))
      );

      expect(text(el(rowFor(page, 'Living Expenses'), '.jar-amount'))).toBe(
        '9,007,199,254,740,993 VND / 9,007,199,254,740,993,123 VND'
      );
    });

    it('tints each row by jar type through a CSS custom property', async () => {
      const page = await readyPage();

      expect(rowFor(page, 'Living Expenses').style.getPropertyValue('--jar-color')).toBe(jarColor('livingExpenses'));
      expect(rowFor(page, 'Entertainment & Travel').style.getPropertyValue('--jar-color')).toBe(
        jarColor('entertainmentAndTravel')
      );
    });

    it('does not show a computed total or any remaining amount', async () => {
      const page = await readyPage();

      const content = text(page.root);
      expect(content).not.toMatch(/total/i);
      expect(content).not.toMatch(/remaining/i);
    });
  });

  describe('progress bars', () => {
    it('exposes role=progressbar with min, max, capped value, value text and a descriptive label', async () => {
      const page = await readyPage();

      expect(barSnapshots(page)).toEqual(CANONICAL_BARS);
      els(page.root, '[role=progressbar]').forEach((bar) => {
        expect(bar.getAttribute('aria-valuemin')).toBe('0');
        expect(bar.getAttribute('aria-valuemax')).toBe('100');
      });
    });

    it('names each bar with the jar name, spent, planned and percent', async () => {
      const page = await readyPage();

      const investment = el(rowFor(page, 'Investment'), '[role=progressbar]');
      const label = investment.getAttribute('aria-label') ?? '';
      expect(label).toContain('Investment');
      expect(label).toContain('3,137,500 VND');
      expect(label).toContain('2,500,000 VND');
      expect(label).toContain('125.5%');
    });

    it('caps the bar width and aria-valuenow at 100 for an over-budget jar, while the text stays unclamped', async () => {
      const page = await readyPage();

      const row = rowFor(page, 'Investment');
      expect(el(row, '.progress-fill').style.width).toBe('100%');
      expect(el(row, '[role=progressbar]').getAttribute('aria-valuenow')).toBe('100');
      expect(text(el(row, '.jar-percent'))).toBe('125.5%');
    });

    it.each([
      ['102.86', 102.86, '102.86%'],
      ['100.01', 100.01, '100.01%'],
      ['a very large', 1250.75, null]
    ])('caps the bar at 100 and flags %s percent as over budget', async (_label, percentageUsed, percentText) => {
      const page = await readyPage(withJars(patchJar(0, { percentageUsed })));

      const row = rowFor(page, 'Living Expenses');
      expect(el(row, '.progress-fill').style.width).toBe('100%');
      expect(el(row, '[role=progressbar]').getAttribute('aria-valuenow')).toBe('100');
      expect(text(el(row, '.over-badge'))).toBe(OVER_BUDGET);
      if (percentText !== null) {
        expect(text(el(row, '.jar-percent'))).toBe(percentText);
      }
    });

    it('shows the visible text "Over budget" only on the jar above 100%', async () => {
      const page = await readyPage();

      expect(rowSnapshots(page).filter((row) => row.badge !== null)).toEqual([CANONICAL_ROWS[5]]);
      expect(text(page.root).match(/Over budget/g)).toHaveLength(1);
      expect(text(el(rowFor(page, 'Investment'), '.jar-footer'))).toContain(OVER_BUDGET);
      expect(rowFor(page, 'Investment').classList).toContain('jar-row--over');
    });

    it('does not flag a jar at exactly 100% as over budget', async () => {
      const page = await readyPage();

      const row = rowFor(page, 'Savings');
      expect(text(el(row, '.jar-percent'))).toBe('100%');
      expect(text(row)).not.toContain(OVER_BUDGET);
      expect(row.querySelector('.over-badge')).toBeNull();
      expect(row.classList).not.toContain('jar-row--over');
      expect(el(row, '[role=progressbar]').getAttribute('aria-valuetext')).toBe('100% used');
    });

    it('shows a zero-spend jar with an empty track and 0%', async () => {
      const page = await readyPage();

      const row = rowFor(page, 'Food');
      expect(el(row, '.progress-fill').style.width).toBe('0%');
      expect(el(row, '[role=progressbar]').getAttribute('aria-valuenow')).toBe('0');
      expect(text(el(row, '.jar-percent'))).toBe('0%');
      expect(text(el(row, '.jar-amount'))).toBe('0 VND / 5,000,000 VND');
      expect(text(row)).not.toContain(OVER_BUDGET);
    });

    it('shows a partially used jar with the backend percentage as the fill width', async () => {
      const page = await readyPage();

      expect(el(rowFor(page, 'Children'), '.progress-fill').style.width).toBe('25%');
      expect(el(rowFor(page, 'Entertainment & Travel'), '.progress-fill').style.width).toBe('33.33%');
    });
  });

  describe('navigation links', () => {
    it('links back to monthly planning with a decorative chevron', async () => {
      const page = await readyPage();

      const back = link(page, 'Back to monthly planning');
      expect(back.getAttribute('href')).toBe('/monthly-planning');
      expect(el(back, 'span').getAttribute('aria-hidden')).toBe('true');
    });

    it('links to the plan of the viewed period', async () => {
      const page = await readyPage();

      expect(link(page, 'View plan').getAttribute('href')).toBe('/monthly-plans/2026/9');
    });

    it('links to add expense pre-filled with the first day of the viewed month', async () => {
      const page = await readyPage();

      expect(link(page, 'Add expense').getAttribute('href')).toBe('/expenses/new?expenseDate=2026-09-01');
    });

    it('navigates to the plan when View plan is clicked', async () => {
      const page = await readyPage();

      link(page, 'View plan').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-plans/2026/9');
    });

    it('navigates to add expense with the pre-filled date when Add expense is clicked', async () => {
      const page = await readyPage();

      link(page, 'Add expense').click();
      await settle(page);

      expect(page.router.url).toBe('/expenses/new?expenseDate=2026-09-01');
    });

    it('navigates to monthly planning from the back link', async () => {
      const page = await readyPage();

      link(page, 'Back to monthly planning').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-planning');
    });

    it('offers the action links while the data is loading', async () => {
      const page = await createPage();

      expect(link(page, 'View plan').getAttribute('href')).toBe('/monthly-plans/2026/9');
      expect(link(page, 'Add expense').getAttribute('href')).toBe('/expenses/new?expenseDate=2026-09-01');

      page.http.expectOne(SEPTEMBER).flush(SPENDING_BY_JARS_FIXTURE);
    });

    it.each([
      ['/monthly-plans/9999/12/spending', 9999, 12, 'December 9999', '9999-12-01'],
      ['/monthly-plans/2026/09/spending', 2026, 9, 'September 2026', '2026-09-01'],
      ['/monthly-plans/1/1/spending', 1, 1, 'January 1', '0001-01-01']
    ])('accepts %s as a valid period', async (url, year, month, label, expenseDate) => {
      const page = await readyPage({ ...SPENDING_BY_JARS_FIXTURE, year, month }, url, SPENDING_BY_JARS(year, month));

      expect(meta(page)).toBe(`${label} · Amounts in VND`);
      expect(link(page, 'View plan').getAttribute('href')).toBe(`/monthly-plans/${year}/${month}`);
      expect(link(page, 'Add expense').getAttribute('href')).toBe(`/expenses/new?expenseDate=${expenseDate}`);
    });

    it('requests the normalised period when a segment has a leading zero', async () => {
      const page = await createPage('/monthly-plans/2026/09/spending');

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.url).toBe(SPENDING_BY_JARS(2026, 9));

      request.flush(SPENDING_BY_JARS_FIXTURE);
    });
  });

  describe('read-only view', () => {
    it('has no edit, delete or form controls', async () => {
      const page = await readyPage();

      expect(buttons(page)).toHaveLength(0);
      expect(els(page.root, 'input, select, textarea, form, [role=button]')).toHaveLength(0);
      const controls = els(page.root, 'a, button')
        .map((control) => `${text(control)} ${control.getAttribute('aria-label') ?? ''}`)
        .join(' ');
      expect(controls).not.toMatch(/edit|delete|remove/i);
    });

    it('offers only the back link, View plan and Add expense', async () => {
      const page = await readyPage();

      expect(anchors(page).map((anchor) => anchor.getAttribute('href'))).toEqual([
        '/monthly-planning',
        '/monthly-plans/2026/9',
        '/expenses/new?expenseDate=2026-09-01'
      ]);
    });
  });

  describe('plan not found', () => {
    const notFoundPage = (): Promise<Page> => failedPage(fail(404, 'Not Found', NOT_FOUND_ERROR_FIXTURE));

    it('shows the "no monthly plan" alert with a Create a plan link, and no rows', async () => {
      const page = await notFoundPage();

      expect(alerts(page)).toHaveLength(1);
      expect(text(alerts(page)[0])).toContain(NOT_FOUND);
      expect(link(page, 'Create a plan').getAttribute('href')).toBe('/monthly-planning');
      expect(link(page, 'Back to monthly planning').getAttribute('href')).toBe('/monthly-planning');
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expect(meta(page)).toBe(SEPTEMBER_META);
      expectNoAmounts(page);
    });

    it('offers no retry, no View plan and no Add expense', async () => {
      const page = await notFoundPage();

      expect(buttons(page)).toHaveLength(0);
      expect(hasLink(page, 'View plan')).toBe(false);
      expect(hasLink(page, 'Add expense')).toBe(false);
      expect(page.root.querySelector('[role=status]')).toBeNull();
    });

    it('shows the page copy, not the raw API message', async () => {
      const page = await notFoundPage();

      expect(text(page.root)).not.toContain(NOT_FOUND_ERROR_FIXTURE.message);
    });

    it('navigates to monthly planning from Create a plan', async () => {
      const page = await notFoundPage();

      link(page, 'Create a plan').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-planning');
    });

    it.each<[string, Body]>([
      ['an empty body', {}],
      ['another error code', { code: 'SOMETHING_ELSE', message: 'Not here.', errors: [] }]
    ])('shows the retryable error state for a 404 with %s', async (_label, body) => {
      const page = await failedPage(fail(404, 'Not Found', body));

      expect(text(el(page.root, '[role=alert]'))).toContain(LOAD_FAILED);
      expect(text(page.root)).not.toContain(NOT_FOUND);
      expect(retryButton(page).type).toBe('button');
      expectNoAmounts(page);
    });
  });

  describe('load failures and retry', () => {
    it('shows the generic message and a retry button for a 500, never the raw server message', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      expect(alerts(page)).toHaveLength(1);
      expect(text(alerts(page)[0])).toContain(LOAD_FAILED);
      expect(retryButton(page).type).toBe('button');
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expectNoAmounts(page);
    });

    it('never lets the raw error body reach the DOM', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      const content = text(page.root);
      expect(content).not.toContain(INTERNAL_ERROR_FIXTURE.message);
      expect(content).not.toContain('stack trace');
      expect(content).not.toContain('INTERNAL_ERROR');
      expect(page.root.innerHTML).not.toContain('Unhandled exception');
    });

    it('shows the generic message for a non-JSON 503', async () => {
      const page = await failedPage(fail(503, 'Service Unavailable', '<html>Bad gateway</html>'));

      expect(text(el(page.root, '[role=alert]'))).toContain(LOAD_FAILED);
      expect(text(page.root)).not.toContain('Bad gateway');
      expect(retryButton(page).type).toBe('button');
    });

    it('shows the network message with a retry button when the server is unreachable', async () => {
      const page = await failedPage(NETWORK_FAILURE);

      expect(text(el(page.root, '[role=alert]'))).toContain(NETWORK_FAILED);
      expect(retryButton(page).type).toBe('button');
      expectNoAmounts(page);
    });

    it('keeps the action links in the error state so the user can still leave', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      expect(link(page, 'Back to monthly planning').getAttribute('href')).toBe('/monthly-planning');
      expect(link(page, 'View plan').getAttribute('href')).toBe('/monthly-plans/2026/9');
    });

    it('re-issues exactly one GET on Try again, shows loading meanwhile, then renders the rows', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      retryButton(page).click();
      render(page);

      const request = page.http.expectOne(SEPTEMBER);
      expect(request.request.method).toBe('GET');
      expect(text(el(page.root, '[role=status]'))).toBe(LOADING);
      expect(alerts(page)).toHaveLength(0);
      expect(buttons(page)).toHaveLength(0);
      expect(els(page.root, '.jar-list > .jar-row')).toHaveLength(7);
      expectNoAmounts(page);

      request.flush(SPENDING_BY_JARS_FIXTURE);
      await settle(page);

      expectReady(page);
      expect(rowSnapshots(page)).toEqual(CANONICAL_ROWS);
      expect(text(page.root)).not.toContain(LOAD_FAILED);
    });

    it('retries after a network error and renders the rows', async () => {
      const page = await failedPage(NETWORK_FAILURE);

      retryButton(page).click();
      render(page);
      await answer(page, ok(SPENDING_BY_JARS_FIXTURE));

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
      await answer(page, ok(SPENDING_BY_JARS_FIXTURE));

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

      live[0].flush(SPENDING_BY_JARS_FIXTURE);
      await settle(page);
      expectReady(page);
    });

    it('shows fresh numbers after a retry, not the failed attempt', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      retryButton(page).click();
      render(page);
      await answer(page, ok(withJars(patchJar(1, { percentageUsed: 12, spentBudgetVnd: '600000' }))));

      expect(rowSnapshots(page)[1]).toEqual({
        name: 'Food',
        percent: '12%',
        amount: '600,000 VND / 5,000,000 VND',
        badge: null
      });
    });
  });

  describe('malformed 200 responses', () => {
    it.each(MALFORMED_SPENDING)('shows a data-integrity error and no amounts for %s', async (_label, body) => {
      const page = await readyPage(body);

      expect(alerts(page)).toHaveLength(1);
      expect(text(alerts(page)[0])).toContain(INTEGRITY_FAILED);
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expect(retryButton(page).type).toBe('button');
      expectNoAmounts(page);
    });

    it('does not show the integrity error for a well-formed response', async () => {
      const page = await readyPage();

      expect(text(page.root)).not.toContain(INTEGRITY_FAILED);
    });

    it('retries a malformed response and renders the corrected rows', async () => {
      const page = await readyPage(withJars(JARS.slice(0, 6)));

      retryButton(page).click();
      render(page);
      await answer(page, ok(SPENDING_BY_JARS_FIXTURE));

      expectReady(page);
      expect(rowSnapshots(page)).toEqual(CANONICAL_ROWS);
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
      expect(anchors(page)).toHaveLength(1);
      expect(buttons(page)).toHaveLength(0);
      expect(headings(page, 'h1')).toEqual([TITLE]);
      expect(page.root.querySelector('.spending-meta')).toBeNull();
      expect(page.root.querySelector('[role=status]')).toBeNull();
      expectNoAmounts(page);
    });

    it('lands in the same state when the server answers 400 VALIDATION_ERROR', async () => {
      const page = await failedPage(fail(400, 'Bad Request', VALIDATION_ERROR_FIXTURE));

      expect(text(el(page.root, '[role=alert]'))).toContain(INVALID_PERIOD);
      expect(text(page.root)).not.toContain(VALIDATION_ERROR_FIXTURE.message);
      expect(anchors(page)).toHaveLength(1);
      expect(buttons(page)).toHaveLength(0);
      expect(page.root.querySelector('.spending-meta')).toBeNull();
      expectNoAmounts(page);
    });

    it('shows the retryable error state for a 400 that is not a VALIDATION_ERROR envelope', async () => {
      const page = await failedPage(fail(400, 'Bad Request', {}));

      expect(text(el(page.root, '[role=alert]'))).toContain(LOAD_FAILED);
      expect(text(page.root)).not.toContain(INVALID_PERIOD);
      expect(retryButton(page).type).toBe('button');
      expectNoAmounts(page);
    });

    it('navigates to monthly planning from the way-back link', async () => {
      const page = await createPage('/monthly-plans/abc/9/spending');

      link(page, 'Back to monthly planning').click();
      await settle(page);

      expect(page.router.url).toBe('/monthly-planning');
    });
  });

  describe('route param changes', () => {
    it('reloads on the same component instance and shows only the new month', async () => {
      const page = await readyPage();
      expect(meta(page)).toBe(SEPTEMBER_META);

      const next = await page.harness.navigateByUrl(OCTOBER_URL, SpendingByJarPageComponent);
      render(page);

      expect(next).toBe(page.component);
      // loading again: the September rows must be gone while October is in flight
      expect(text(el(page.root, '[role=status]'))).toBe(LOADING);
      expect(meta(page)).toBe(OCTOBER_META);
      expectNoAmounts(page);
      const request = page.http.expectOne(OCTOBER);
      expect(request.request.method).toBe('GET');

      request.flush(OCTOBER_SPENDING_BY_JARS_FIXTURE);
      await settle(page);

      expectReady(page);
      expect(meta(page)).toBe(OCTOBER_META);
      expect(rowSnapshots(page)).toEqual(
        CANONICAL_ROWS.map((row) => ({
          ...row,
          percent: '0%',
          amount: `0 VND / ${row.amount.split(' / ')[1]}`,
          badge: null
        }))
      );
      expect(text(page.root)).not.toContain('125.5%');
      expect(text(page.root)).not.toContain('4,375,000');
      expect(text(page.root)).not.toContain(OVER_BUDGET);
      expect(link(page, 'View plan').getAttribute('href')).toBe('/monthly-plans/2026/10');
      expect(link(page, 'Add expense').getAttribute('href')).toBe('/expenses/new?expenseDate=2026-10-01');
    });

    it('cancels the in-flight GET of the previous period, so its late response cannot be delivered', async () => {
      const page = await createPage();
      const stale = page.http.expectOne(SEPTEMBER);

      await page.harness.navigateByUrl(OCTOBER_URL, SpendingByJarPageComponent);
      render(page);
      const fresh = page.http.expectOne(OCTOBER);

      expect(stale.cancelled).toBe(true);
      expect(fresh.cancelled).toBe(false);
      expect(() => stale.flush(SPENDING_BY_JARS_FIXTURE)).toThrow(/cancelled/i);
      render(page);
      expect(text(el(page.root, '[role=status]'))).toBe(LOADING);
      expectNoAmounts(page);

      fresh.flush(OCTOBER_SPENDING_BY_JARS_FIXTURE);
      await settle(page);

      expect(meta(page)).toBe(OCTOBER_META);
      expect(text(page.root)).not.toContain('125.5%');
    });

    it('ignores a response for the previous period that arrives after the new request started', async () => {
      const responses = new Map<string, Subject<SpendingByJarsResponse>>();
      vi.spyOn(TestBed.inject(BudgetPlanApiService), 'getSpendingByJars').mockImplementation((year, month) => {
        const subject = new Subject<SpendingByJarsResponse>();
        responses.set(`${year}/${month}`, subject);
        return subject;
      });
      const subjectFor = (key: string): Subject<SpendingByJarsResponse> => {
        const subject = responses.get(key);
        if (!subject) {
          throw new Error(`No request was made for ${key}`);
        }
        return subject;
      };
      const page = await createPage(SEPTEMBER_URL);

      await page.harness.navigateByUrl(OCTOBER_URL, SpendingByJarPageComponent);
      render(page);
      expect([...responses.keys()]).toEqual(['2026/9', '2026/10']);

      subjectFor('2026/9').next(SPENDING_BY_JARS_FIXTURE);
      await settle(page);

      expect(text(el(page.root, '[role=status]'))).toBe(LOADING);
      expectNoAmounts(page);

      subjectFor('2026/10').next(OCTOBER_SPENDING_BY_JARS_FIXTURE);
      await settle(page);

      expect(meta(page)).toBe(OCTOBER_META);
      expectReady(page);

      // a straggler for September after October is already shown still changes nothing
      subjectFor('2026/9').next(SPENDING_BY_JARS_FIXTURE);
      await settle(page);

      expect(meta(page)).toBe(OCTOBER_META);
      expect(text(page.root)).not.toContain('125.5%');
      expect(text(page.root)).not.toContain(OVER_BUDGET);
    });

    it('does not keep the previous rows when the next period has no plan', async () => {
      const page = await readyPage();

      await page.harness.navigateByUrl(OCTOBER_URL, SpendingByJarPageComponent);
      render(page);
      await answer(page, fail(404, 'Not Found', NOT_FOUND_ERROR_FIXTURE), OCTOBER);

      expect(text(el(page.root, '[role=alert]'))).toContain(NOT_FOUND);
      expect(meta(page)).toBe(OCTOBER_META);
      expectNoAmounts(page);
    });

    it('does not keep the previous rows when the next period is invalid, and issues no request', async () => {
      const page = await readyPage();

      await page.harness.navigateByUrl('/monthly-plans/2026/13/spending', SpendingByJarPageComponent);
      render(page);

      page.http.expectNone(() => true);
      expect(text(el(page.root, '[role=alert]'))).toContain(INVALID_PERIOD);
      expectNoAmounts(page);
    });

    it('does not keep the previous rows when the next period fails to load', async () => {
      const page = await readyPage();

      await page.harness.navigateByUrl(OCTOBER_URL, SpendingByJarPageComponent);
      render(page);
      await answer(page, fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE), OCTOBER);

      expect(text(el(page.root, '[role=alert]'))).toContain(LOAD_FAILED);
      expectNoAmounts(page);
    });

    it('recovers from an invalid period when the route becomes valid again', async () => {
      const page = await createPage('/monthly-plans/abc/9/spending');

      await page.harness.navigateByUrl(SEPTEMBER_URL, SpendingByJarPageComponent);
      render(page);
      await answer(page, ok(SPENDING_BY_JARS_FIXTURE));

      expectReady(page);
      expect(rowSnapshots(page)).toEqual(CANONICAL_ROWS);
    });

    it('retries the period that is currently in the route after a param change', async () => {
      const page = await readyPage();

      await page.harness.navigateByUrl(OCTOBER_URL, SpendingByJarPageComponent);
      render(page);
      await answer(page, fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE), OCTOBER);

      retryButton(page).click();
      render(page);
      page.http.expectNone(SEPTEMBER);
      await answer(page, ok(OCTOBER_SPENDING_BY_JARS_FIXTURE), OCTOBER);

      expect(meta(page)).toBe(OCTOBER_META);
      expectReady(page);
    });

    it('refetches on every visit, so newly created expenses show up (no caching)', async () => {
      const page = await readyPage();
      expect(rowSnapshots(page)[1].percent).toBe('0%');

      await page.harness.navigateByUrl('/monthly-planning');
      page.http.expectNone(() => true);
      // Coming back creates a new page instance, so the host element differs from the first visit.
      const component = await page.harness.navigateByUrl(SEPTEMBER_URL, SpendingByJarPageComponent);
      render(page);
      const root = page.harness.routeNativeElement;
      if (root === null) {
        throw new Error('The routed page was not rendered');
      }
      const revisit: Page = { ...page, component, root };

      expect(component).not.toBe(page.component);
      const request = page.http.expectOne(SEPTEMBER);
      expect(text(el(revisit.root, '[role=status]'))).toBe(LOADING);
      expectNoAmounts(revisit);
      request.flush(withJars(patchJar(1, { percentageUsed: 12, spentBudgetVnd: '600000' })));
      await settle(revisit);

      expect(rowSnapshots(revisit)[1]).toEqual({
        name: 'Food',
        percent: '12%',
        amount: '600,000 VND / 5,000,000 VND',
        badge: null
      });
    });
  });

  describe('accessibility', () => {
    it('labels the content region by the page heading', async () => {
      const page = await readyPage();

      const section = el(page.root, 'section');
      expect(section.getAttribute('aria-labelledby')).toBe('spending-title');
      expect(text(el(page.root, '#spending-title'))).toBe(TITLE);
      expect(el(page.root, '#spending-title').tagName).toBe('H1');
    });

    it('lists the jars in a named list with one item per jar', async () => {
      const page = await readyPage();

      const list = el(page.root, 'ul');
      expect(list.getAttribute('role')).toBe('list');
      expect(list.getAttribute('aria-label')).toBe(TITLE);
      expect(jarItems(page)).toHaveLength(7);
    });

    it('gives every progress bar a non-empty accessible name', async () => {
      const page = await readyPage();

      const bars = els(page.root, '[role=progressbar]');
      expect(bars).toHaveLength(7);
      bars.forEach((bar) => expect((bar.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0));
    });

    it('states over budget in words, not by colour only', async () => {
      const page = await readyPage();

      const row = rowFor(page, 'Investment');
      expect(text(row)).toContain(OVER_BUDGET);
      expect(el(row, '[role=progressbar]').getAttribute('aria-valuetext')).toContain('over budget');
    });

    it('announces failures with role=alert and hides the decorative icon', async () => {
      const page = await failedPage(fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE));

      expect(alerts(page)).toHaveLength(1);
      expect(el(alerts(page)[0], '.state-icon').getAttribute('aria-hidden')).toBe('true');
    });

    it.each([
      ['not found', fail(404, 'Not Found', NOT_FOUND_ERROR_FIXTURE)],
      ['a server error', fail(500, 'Internal Server Error', INTERNAL_ERROR_FIXTURE)],
      ['a network error', NETWORK_FAILURE],
      ['a malformed response', ok(withJars(JARS.slice(0, 6)))]
    ])('announces %s as exactly one alert and no live status', async (_label, respond) => {
      const page = await failedPage(respond);

      expect(alerts(page)).toHaveLength(1);
      expect(page.root.querySelector('[role=status]')).toBeNull();
    });
  });
});
