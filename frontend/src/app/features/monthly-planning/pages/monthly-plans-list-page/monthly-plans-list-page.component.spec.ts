import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUDGET_PLAN_ENDPOINTS } from '../../../../constants/api-endpoints';
import { MonthlyPlanSummary } from '../../../../models/budget-plan.models';
import {
  INTERNAL_ERROR_FIXTURE,
  MONTHLY_PLAN_SUMMARIES_FIXTURE,
  NOT_FOUND_ERROR_FIXTURE
} from '../../../../testing/fixtures';
import {
  DELETE_FAILED_MESSAGE,
  LOAD_FAILED_MESSAGE,
  MonthlyPlansListPageComponent
} from './monthly-plans-list-page.component';

const { PLANS, BY_PERIOD } = BUDGET_PLAN_ENDPOINTS;

const LOADING = 'Loading your monthly plans…';
const EMPTY = 'You have not created any monthly plan yet.';
const NETWORK_FAILED = 'We could not reach the server. Check your connection and try again.';

/** Today in the fixture's newest month (November 2026), and a day in a month that has no plan (December 2026). */
const NOVEMBER_13 = new Date(2026, 10, 13, 12);
const DECEMBER_5 = new Date(2026, 11, 5, 12);

interface Page {
  harness: RouterTestingHarness;
  component: MonthlyPlansListPageComponent;
  http: HttpTestingController;
  root: HTMLElement;
}

interface CardSnapshot {
  label: string;
  facts: string[];
  usage: string;
  current: boolean;
  overBudget: boolean;
}

type Respond = (call: TestRequest) => void;

const ok =
  (body: object | null): Respond =>
  (call) =>
    call.flush(body);
const serverError: Respond = (call) =>
  call.flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' });
const notFound: Respond = (call) => call.flush(null, { status: 404, statusText: 'Not Found' });
const networkError: Respond = (call) => call.error(new ProgressEvent('error'));

const text = (element: Element | null): string => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const createPage = async (): Promise<Page> => {
  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl('/monthly-plans', MonthlyPlansListPageComponent);
  harness.detectChanges();
  const root = harness.routeNativeElement;
  if (root === null) {
    throw new Error('The routed page was not rendered');
  }
  return { harness, component, http: TestBed.inject(HttpTestingController), root };
};

const answer = (page: Page, respond: Respond): void => {
  const call = page.http.expectOne(PLANS);
  expect(call.request.method).toBe('GET');
  respond(call);
  page.harness.detectChanges();
};

const readyPage = async (plans: object | null = MONTHLY_PLAN_SUMMARIES_FIXTURE): Promise<Page> => {
  const page = await createPage();
  answer(page, ok(plans));
  return page;
};

const cards = (page: Page): HTMLElement[] => Array.from(page.root.querySelectorAll<HTMLElement>('li.month-card'));

const snapshot = (card: HTMLElement): CardSnapshot => ({
  label: text(card.querySelector('h3')),
  facts: Array.from(card.querySelectorAll('dl > div')).map(
    (fact) => `${text(fact.querySelector('dt'))} ${text(fact.querySelector('dd'))}`
  ),
  usage: text(card.querySelector('.month-usage > span')),
  current: card.querySelector('.badge-current') !== null,
  overBudget: card.querySelector('.over-badge') !== null
});

const yearHeadings = (page: Page): string[] =>
  Array.from(page.root.querySelectorAll('h2')).map((heading) => text(heading));

const linkHrefs = (card: HTMLElement): Record<string, string | null> =>
  Object.fromEntries(
    Array.from(card.querySelectorAll('.month-actions a')).map((link) => [text(link), link.getAttribute('href')])
  );

const alertMessage = (page: Page): string => text(page.root.querySelector('[role=alert] .state-message'));
const banner = (page: Page): HTMLElement | null => page.root.querySelector('.current-missing');
const loading = (page: Page): string => text(page.root.querySelector('.loading-message'));
const tryAgain = (page: Page): HTMLButtonElement | null =>
  Array.from(page.root.querySelectorAll('button')).find((button) => text(button) === 'Try again') ?? null;

const plan = (patch: Partial<MonthlyPlanSummary>): MonthlyPlanSummary => ({
  ...MONTHLY_PLAN_SUMMARIES_FIXTURE[0],
  ...patch
});

describe('MonthlyPlansListPageComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOVEMBER_13);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'monthly-plans', component: MonthlyPlansListPageComponent },
          { path: 'monthly-plans/:year/:month', children: [] },
          { path: 'monthly-plans/:year/:month/spending', children: [] },
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
    vi.useRealTimers();
  });

  describe('loading', () => {
    it('sends exactly one GET to the plans endpoint and shows the loading text until it answers', async () => {
      const page = await createPage();

      const call = page.http.expectOne(PLANS);
      expect(call.request.method).toBe('GET');
      expect(call.request.body).toBeNull();
      expect(loading(page)).toBe(LOADING);
      expect(page.root.querySelector('.loading-message')?.getAttribute('role')).toBe('status');
      expect(cards(page)).toHaveLength(0);
      expect(banner(page)).toBeNull();

      call.flush(MONTHLY_PLAN_SUMMARIES_FIXTURE);
      page.harness.detectChanges();

      expect(page.root.querySelector('.loading-message')).toBeNull();
    });

    it('exposes no groups, no error message and no missing-month prompt before the list arrives', async () => {
      const page = await createPage();

      expect(page.component.status()).toBe('loading');
      expect(page.component.groups()).toEqual([]);
      expect(page.component.errorMessage()).toBe('');
      expect(page.component.currentMonthMissing()).toBe(false);
      answer(page, ok(MONTHLY_PLAN_SUMMARIES_FIXTURE));
    });

    it('always offers to create a plan from the heading', async () => {
      const page = await createPage();

      expect(text(page.root.querySelector('h1'))).toBe('All months');
      const create = Array.from(page.root.querySelectorAll('a')).find(
        (link) => text(link) === 'Create monthly plan'
      );
      expect(create?.getAttribute('href')).toBe('/monthly-planning');
      answer(page, ok(MONTHLY_PLAN_SUMMARIES_FIXTURE));
    });
  });

  describe('ready', () => {
    it('groups months by year in response order, newest first', async () => {
      const page = await readyPage();

      expect(yearHeadings(page)).toEqual(['2026', '2025']);
      const groups = Array.from(page.root.querySelectorAll('section.year-group'));
      expect(groups.map((group) => group.getAttribute('aria-labelledby'))).toEqual(['year-2026', 'year-2025']);
      expect(groups.map((group) => Array.from(group.querySelectorAll('h3')).map((label) => text(label)))).toEqual([
        ['November 2026', 'September 2026'],
        ['December 2025']
      ]);
    });

    it('never sorts: an older month returned first stays first, and a year that comes back starts a new group', async () => {
      const page = await readyPage([
        plan({ year: 2025, month: 1 }),
        plan({ year: 2026, month: 3 }),
        plan({ year: 2025, month: 2 })
      ]);

      expect(yearHeadings(page)).toEqual(['2025', '2026', '2025']);
      expect(cards(page).map((card) => text(card.querySelector('h3')))).toEqual([
        'January 2025',
        'March 2026',
        'February 2025'
      ]);
    });

    it('shows income, spent, remaining, percent and expense count for each month', async () => {
      const page = await readyPage();

      expect(cards(page).map(snapshot)).toEqual([
        {
          label: 'November 2026',
          facts: ['Income 25,000,000 VND', 'Spent 5,000,000 VND', 'Remaining 20,000,000 VND'],
          usage: '20% used · 1 expense',
          current: true,
          overBudget: false
        },
        {
          label: 'September 2026',
          facts: ['Income 25,000,000 VND', 'Spent 30,000,000 VND', 'Remaining -5,000,000 VND'],
          usage: '120% used · 3 expenses',
          current: false,
          overBudget: true
        },
        {
          label: 'December 2025',
          facts: ['Income 10,000,000 VND', 'Spent 3,333,333 VND', 'Remaining 6,666,667 VND'],
          usage: '33.33% used · 0 expenses',
          current: false,
          overBudget: false
        }
      ]);
    });

    it('flags an over-budget month with a badge and a modifier class', async () => {
      const page = await readyPage();

      const [november, september] = cards(page);
      expect(text(september.querySelector('.over-badge'))).toBe('Over budget');
      expect(september.classList).toContain('month-card--over');
      expect(november.classList).not.toContain('month-card--over');
    });

    it('caps the progress bar at 100 and keeps the real percentage in the accessible text', async () => {
      const page = await readyPage();

      const bars = cards(page).map((card) => card.querySelector<HTMLElement>('[role=progressbar]'));
      expect(bars.map((bar) => bar?.getAttribute('aria-valuenow'))).toEqual(['20', '100', '33.33']);
      expect(bars.map((bar) => bar?.querySelector<HTMLElement>('.progress-fill')?.style.width)).toEqual([
        '20%',
        '100%',
        '33.33%'
      ]);
      expect(bars.map((bar) => bar?.getAttribute('aria-valuetext'))).toEqual([
        '20% of income spent',
        '120% of income spent, over budget',
        '33.33% of income spent'
      ]);
      expect(bars.map((bar) => bar?.getAttribute('aria-label'))).toEqual([
        'November 2026 spending',
        'September 2026 spending',
        'December 2025 spending'
      ]);
    });

    it('keeps the bar at 0 for a negative percentage and rounds the label to two decimals', async () => {
      const page = await readyPage([
        plan({ month: 10, percentageUsed: -5 }),
        plan({ month: 8, percentageUsed: 12.345 }),
        plan({ month: 7, percentageUsed: 100 })
      ]);

      const bars = cards(page).map((card) => card.querySelector('[role=progressbar]'));
      expect(bars.map((bar) => bar?.getAttribute('aria-valuenow'))).toEqual(['0', '12.345', '100']);
      expect(cards(page).map((card) => text(card.querySelector('.month-usage > span')))).toEqual([
        '-5% used · 1 expense',
        '12.35% used · 1 expense',
        '100% used · 1 expense'
      ]);
    });

    it('treats only a remaining amount starting with "-" as over budget', async () => {
      const page = await readyPage([
        plan({ month: 10, remainingVnd: '0', percentageUsed: 100 }),
        plan({ month: 9, remainingVnd: '-1', percentageUsed: 100 })
      ]);

      expect(cards(page).map((card) => snapshot(card).overBudget)).toEqual([false, true]);
    });

    it('links each month to its plan, spending and add-expense pages', async () => {
      const page = await readyPage();

      const [november, september, december] = cards(page);
      expect(november.querySelector('h3 a')?.getAttribute('href')).toBe('/monthly-plans/2026/11');
      expect(linkHrefs(september)).toEqual({
        Plan: '/monthly-plans/2026/9',
        Spending: '/monthly-plans/2026/9/spending',
        'Add expense': '/expenses/new?expenseDate=2026-09-01'
      });
      expect(linkHrefs(december)).toEqual({
        Plan: '/monthly-plans/2025/12',
        Spending: '/monthly-plans/2025/12/spending',
        'Add expense': '/expenses/new?expenseDate=2025-12-01'
      });
    });

    it('opens Add expense on today for the current month (no expenseDate)', async () => {
      const page = await readyPage();

      expect(linkHrefs(cards(page)[0])).toEqual({
        Plan: '/monthly-plans/2026/11',
        Spending: '/monthly-plans/2026/11/spending',
        'Add expense': '/expenses/new'
      });
    });

    it('marks only the current month with the "This month" badge and no missing-plan banner', async () => {
      const page = await readyPage();

      expect(cards(page).map((card) => text(card.querySelector('.badge-current')))).toEqual(['This month', '', '']);
      expect(cards(page)[0].classList).toContain('month-card--current');
      expect(cards(page)[1].classList).not.toContain('month-card--current');
      expect(banner(page)).toBeNull();
    });

    it('shows the empty state with a link to create the first plan', async () => {
      const page = await readyPage([]);

      expect(text(page.root.querySelector('.state-message'))).toBe(EMPTY);
      const create = Array.from(page.root.querySelectorAll('a')).find(
        (link) => text(link) === 'Create your first plan'
      );
      expect(create?.getAttribute('href')).toBe('/monthly-planning');
      expect(cards(page)).toHaveLength(0);
      expect(yearHeadings(page)).toEqual([]);
      expect(page.root.querySelector('[role=alert]')).toBeNull();
    });
  });

  describe('current month without a plan', () => {
    beforeEach(() => {
      vi.setSystemTime(DECEMBER_5);
    });

    it('offers to plan the current month with a link carrying the period', async () => {
      const page = await readyPage();

      const missing = banner(page);
      expect(missing?.getAttribute('role')).toBe('status');
      expect(text(missing?.querySelector('p') ?? null)).toBe('There is no plan for December 2026 yet.');
      const link = missing?.querySelector('a');
      expect(text(link ?? null)).toBe('Plan December 2026');
      expect(link?.getAttribute('href')).toBe('/monthly-planning?period=2026-12');
    });

    it('shows no "This month" badge and pre-fills every Add expense link with the first day of its month', async () => {
      const page = await readyPage();

      expect(page.root.querySelector('.badge-current')).toBeNull();
      expect(cards(page).map((card) => linkHrefs(card)['Add expense'])).toEqual([
        '/expenses/new?expenseDate=2026-11-01',
        '/expenses/new?expenseDate=2026-09-01',
        '/expenses/new?expenseDate=2025-12-01'
      ]);
    });

    it('also shows the banner above the empty state', async () => {
      const page = await readyPage([]);

      expect(text(banner(page)?.querySelector('p') ?? null)).toBe('There is no plan for December 2026 yet.');
      expect(text(page.root.querySelector('.state-message'))).toBe(EMPTY);
    });

    it('pads the period of an early month', async () => {
      vi.setSystemTime(new Date(2027, 0, 2, 12));
      const page = await readyPage([]);

      expect(banner(page)?.querySelector('a')?.getAttribute('href')).toBe('/monthly-planning?period=2027-01');
    });

    it('does not show the banner while loading or after an error', async () => {
      const page = await createPage();
      expect(banner(page)).toBeNull();

      answer(page, serverError);

      expect(banner(page)).toBeNull();
    });
  });

  describe('errors', () => {
    it('shows the generic message for a 500, never the raw body', async () => {
      const page = await createPage();
      answer(page, serverError);

      expect(alertMessage(page)).toBe(LOAD_FAILED_MESSAGE);
      expect(page.root.textContent).not.toContain(INTERNAL_ERROR_FIXTURE.message);
      expect(cards(page)).toHaveLength(0);
      expect(page.root.querySelector('.loading-message')).toBeNull();
    });

    it('shows the generic message for a bare 404', async () => {
      const page = await createPage();
      answer(page, notFound);

      expect(alertMessage(page)).toBe(LOAD_FAILED_MESSAGE);
    });

    it('shows the network message when the server cannot be reached', async () => {
      const page = await createPage();
      answer(page, networkError);

      expect(alertMessage(page)).toBe(NETWORK_FAILED);
    });

    it.each<[string, object | null]>([
      ['a null body', null],
      ['an object instead of a list', { plans: MONTHLY_PLAN_SUMMARIES_FIXTURE }]
    ])('treats %s as a failed load', async (_label, body) => {
      const page = await createPage();
      answer(page, ok(body));

      expect(alertMessage(page)).toBe(LOAD_FAILED_MESSAGE);
      expect(cards(page)).toHaveLength(0);
    });

    it('Try again shows loading, re-issues exactly one GET and renders the answer', async () => {
      const page = await createPage();
      answer(page, networkError);

      tryAgain(page)?.click();
      page.harness.detectChanges();

      expect(loading(page)).toBe(LOADING);
      expect(page.root.querySelector('[role=alert]')).toBeNull();
      answer(page, ok(MONTHLY_PLAN_SUMMARIES_FIXTURE));

      expect(cards(page)).toHaveLength(3);
      expect(page.root.querySelector('[role=alert]')).toBeNull();
      page.http.expectNone(PLANS);
    });

    it('can fail again after a retry and still offer Try again', async () => {
      const page = await createPage();
      answer(page, networkError);

      tryAgain(page)?.click();
      page.harness.detectChanges();
      answer(page, serverError);

      expect(alertMessage(page)).toBe(LOAD_FAILED_MESSAGE);
      expect(tryAgain(page)).not.toBeNull();
    });

    it('a second click while a retry is pending cancels the earlier request', async () => {
      const page = await createPage();
      answer(page, networkError);

      page.component.retry();
      const first = page.http.expectOne(PLANS);
      page.component.retry();

      expect(first.cancelled).toBe(true);
      answer(page, ok([]));
      expect(text(page.root.querySelector('.state-message'))).toBe(EMPTY);
    });
  });

  describe('deleting a month', () => {
    const SEPTEMBER = BY_PERIOD(2026, 9);
    const DELETE_SEPTEMBER = { method: 'DELETE', url: SEPTEMBER };
    const noContent: Respond = (call) => call.flush(null, { status: 204, statusText: 'No Content' });
    const notFoundEnvelope: Respond = (call) =>
      call.flush(NOT_FOUND_ERROR_FIXTURE, { status: 404, statusText: 'Not Found' });
    const WITHOUT_SEPTEMBER = MONTHLY_PLAN_SUMMARIES_FIXTURE.filter((summary) => summary.month !== 9);

    const deleteButtons = (page: Page): HTMLButtonElement[] =>
      Array.from(page.root.querySelectorAll<HTMLButtonElement>('button.delete-button'));
    const deleteButton = (page: Page, label: string): HTMLButtonElement => {
      const found = page.root.querySelector<HTMLButtonElement>(`button[aria-label="Delete ${label} plan"]`);
      if (found === null) {
        throw new Error(`Delete button not found: ${label}`);
      }
      return found;
    };
    const notice = (page: Page): HTMLElement | null => page.root.querySelector('.delete-notice');
    const setupLink = (page: Page): HTMLAnchorElement | null =>
      page.root.querySelector<HTMLAnchorElement>('.delete-notice a');

    let confirm: MockInstance<(message?: string) => boolean>;

    /** Clicks Delete on the September card with the confirmation accepted, and returns its pending DELETE. */
    const startDelete = (page: Page): TestRequest => {
      confirm.mockReturnValue(true);
      deleteButton(page, 'September 2026').click();
      page.harness.detectChanges();
      return page.http.expectOne(DELETE_SEPTEMBER);
    };

    beforeEach(() => {
      confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('gives every month card an enabled, typed Delete button named after its month', async () => {
      const page = await readyPage();

      expect(deleteButtons(page).map((button) => button.getAttribute('aria-label'))).toEqual([
        'Delete November 2026 plan',
        'Delete September 2026 plan',
        'Delete December 2025 plan'
      ]);
      expect(deleteButtons(page).map((button) => text(button))).toEqual(['Delete', 'Delete', 'Delete']);
      expect(deleteButtons(page).every((button) => button.type === 'button' && !button.disabled)).toBe(true);
      expect(deleteButtons(page).map((button) => button.getAttribute('aria-busy'))).toEqual([
        'false',
        'false',
        'false'
      ]);
      expect(notice(page)).toBeNull();
    });

    it.each([
      ['November 2026', 'Delete the November 2026 plan and its 1 expense? This cannot be undone.'],
      ['September 2026', 'Delete the September 2026 plan and its 3 expenses? This cannot be undone.'],
      ['December 2025', 'Delete the December 2025 plan and its 0 expenses? This cannot be undone.']
    ])('asks for confirmation naming %s and its expense count', async (label, question) => {
      const page = await readyPage();

      deleteButton(page, label).click();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledWith(question);
    });

    it('sends no request and changes nothing when the confirmation is cancelled', async () => {
      const page = await readyPage();

      deleteButton(page, 'September 2026').click();
      page.harness.detectChanges();

      page.http.expectNone(SEPTEMBER);
      page.http.expectNone(PLANS);
      expect(deleteButtons(page).map((button) => text(button))).toEqual(['Delete', 'Delete', 'Delete']);
      expect(deleteButtons(page).some((button) => button.disabled)).toBe(false);
      expect(page.component.deletingKey()).toBeNull();
      expect(notice(page)).toBeNull();
    });

    it('sends one DELETE for the card period, shows "Deleting…" on it and locks every delete button', async () => {
      const page = await readyPage();

      const call = startDelete(page);

      expect(call.request.method).toBe('DELETE');
      expect(call.request.body).toBeNull();
      expect(page.component.deletingKey()).toBe('2026-9');
      expect(deleteButtons(page).map((button) => text(button))).toEqual(['Delete', 'Deleting…', 'Delete']);
      expect(deleteButtons(page).every((button) => button.disabled)).toBe(true);
      expect(deleteButtons(page).map((button) => button.getAttribute('aria-busy'))).toEqual([
        'false',
        'true',
        'false'
      ]);
      page.http.expectNone(PLANS);

      call.flush(null, { status: 204, statusText: 'No Content' });
      answer(page, ok(WITHOUT_SEPTEMBER));
    });

    it('ignores a second delete while one is in flight: no confirmation and no second request', async () => {
      const page = await readyPage();
      const call = startDelete(page);
      confirm.mockClear();

      // the disabled buttons swallow clicks, and a direct call is ignored too
      deleteButton(page, 'November 2026').click();
      page.component.deleteMonth(page.component.groups()[0].months[0]);
      page.component.deleteMonth(page.component.groups()[0].months[1]);
      page.harness.detectChanges();

      expect(confirm).not.toHaveBeenCalled();
      page.http.expectNone({ method: 'DELETE', url: BY_PERIOD(2026, 11) });
      page.http.expectNone(DELETE_SEPTEMBER);
      expect(page.component.deletingKey()).toBe('2026-9');

      noContent(call);
      answer(page, ok(WITHOUT_SEPTEMBER));
    });

    it('on 204 announces the deletion, offers to set the month up again and reloads the list', async () => {
      const page = await readyPage();

      noContent(startDelete(page));
      page.harness.detectChanges();

      const shown = notice(page);
      expect(shown?.getAttribute('role')).toBe('status');
      expect(shown?.classList).not.toContain('delete-notice--error');
      expect(text(shown?.querySelector('p') ?? null)).toBe('September 2026 was deleted.');
      expect(text(setupLink(page))).toBe('Set up September 2026 again');
      expect(setupLink(page)?.getAttribute('href')).toBe('/monthly-planning?period=2026-09');
      expect(page.component.deletingKey()).toBeNull();
      // the reload is in flight: the list shows loading
      expect(loading(page)).toBe(LOADING);

      answer(page, ok(WITHOUT_SEPTEMBER));

      expect(cards(page).map((card) => text(card.querySelector('h3')))).toEqual(['November 2026', 'December 2025']);
      expect(deleteButtons(page).every((button) => !button.disabled)).toBe(true);
      expect(deleteButtons(page).map((button) => text(button))).toEqual(['Delete', 'Delete']);
      expect(text(notice(page)?.querySelector('p') ?? null)).toBe('September 2026 was deleted.');
      expect(page.root.querySelector('[role=alert]')).toBeNull();
    });

    it('navigates to monthly planning with the deleted month from "Set up … again"', async () => {
      const page = await readyPage();
      noContent(startDelete(page));
      answer(page, ok(WITHOUT_SEPTEMBER));

      setupLink(page)?.click();
      await page.harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/monthly-planning?period=2026-09');
    });

    it('pads the period of an early month in the set-up link', async () => {
      const page = await readyPage([plan({ year: 2026, month: 3, expenseCount: 2 })]);
      confirm.mockReturnValue(true);

      deleteButton(page, 'March 2026').click();
      page.http
        .expectOne({ method: 'DELETE', url: BY_PERIOD(2026, 3) })
        .flush(null, { status: 204, statusText: 'No Content' });
      answer(page, ok([]));

      expect(confirm).toHaveBeenCalledWith('Delete the March 2026 plan and its 2 expenses? This cannot be undone.');
      expect(setupLink(page)?.getAttribute('href')).toBe('/monthly-planning?period=2026-03');
      expect(text(page.root.querySelector('.state-message'))).toBe(EMPTY);
    });

    it.each<[string, Respond]>([
      ['a bare 404', notFound],
      ['a MONTHLY_PLAN_NOT_FOUND 404', notFoundEnvelope]
    ])('treats %s as already deleted: success notice and a reload', async (_label, respond) => {
      const page = await readyPage();

      respond(startDelete(page));
      answer(page, ok(WITHOUT_SEPTEMBER));

      expect(notice(page)?.getAttribute('role')).toBe('status');
      expect(text(notice(page)?.querySelector('p') ?? null)).toBe('September 2026 was deleted.');
      expect(setupLink(page)?.getAttribute('href')).toBe('/monthly-planning?period=2026-09');
      expect(page.root.querySelector('[role=alert]')).toBeNull();
      expect(cards(page)).toHaveLength(2);
    });

    it('on 500 shows an alert with the generic message and the month, keeps the list and re-enables the buttons', async () => {
      const page = await readyPage();

      serverError(startDelete(page));
      page.harness.detectChanges();

      const shown = notice(page);
      expect(shown?.getAttribute('role')).toBe('alert');
      expect(shown?.classList).toContain('delete-notice--error');
      expect(text(shown?.querySelector('p') ?? null)).toBe(`${DELETE_FAILED_MESSAGE} (September 2026)`);
      expect(page.root.textContent).not.toContain(INTERNAL_ERROR_FIXTURE.message);
      expect(setupLink(page)).toBeNull();
      page.http.expectNone(PLANS);
      expect(cards(page)).toHaveLength(3);
      expect(page.component.deletingKey()).toBeNull();
      expect(deleteButtons(page).map((button) => text(button))).toEqual(['Delete', 'Delete', 'Delete']);
      expect(deleteButtons(page).every((button) => !button.disabled)).toBe(true);
    });

    it('shows the network message when the server cannot be reached, and re-enables the buttons', async () => {
      const page = await readyPage();

      networkError(startDelete(page));
      page.harness.detectChanges();

      expect(notice(page)?.getAttribute('role')).toBe('alert');
      expect(text(notice(page)?.querySelector('p') ?? null)).toBe(NETWORK_FAILED);
      expect(setupLink(page)).toBeNull();
      page.http.expectNone(PLANS);
      expect(deleteButtons(page).every((button) => !button.disabled)).toBe(true);
    });

    it('can retry after a failure: the error is cleared while the new delete is in flight, then succeeds', async () => {
      const page = await readyPage();
      serverError(startDelete(page));
      page.harness.detectChanges();
      expect(notice(page)?.getAttribute('role')).toBe('alert');

      const retry = startDelete(page);

      expect(confirm).toHaveBeenCalledTimes(2);
      expect(notice(page)).toBeNull();
      expect(text(deleteButton(page, 'September 2026'))).toBe('Deleting…');

      noContent(retry);
      answer(page, ok(WITHOUT_SEPTEMBER));

      expect(notice(page)?.getAttribute('role')).toBe('status');
      expect(text(notice(page)?.querySelector('p') ?? null)).toBe('September 2026 was deleted.');
    });

    it('keeps the success notice when the reload after a delete fails, next to the load error', async () => {
      const page = await readyPage();

      noContent(startDelete(page));
      answer(page, serverError);

      expect(text(notice(page)?.querySelector('p') ?? null)).toBe('September 2026 was deleted.');
      expect(alertMessage(page)).toBe(LOAD_FAILED_MESSAGE);
      expect(cards(page)).toHaveLength(0);
    });

    it('cancels an in-flight delete when the page is destroyed, without touching the notice', async () => {
      const page = await readyPage();
      const call = startDelete(page);

      page.harness.fixture.destroy();

      expect(call.cancelled).toBe(true);
      expect(page.component.notice()).toBeNull();
      expect(page.component.deletingKey()).toBeNull();
    });
  });
});
