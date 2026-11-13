import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUDGET_PLAN_ENDPOINTS } from '../../../../constants/api-endpoints';
import { ComparisonMonth, MonthComparisonResponse } from '../../../../models/budget-plan.models';
import { INTERNAL_ERROR_FIXTURE, MONTH_COMPARISON_FIXTURE } from '../../../../testing/fixtures';
import {
  COMPARISON_INVALID_MESSAGE,
  COMPARISON_LOAD_FAILED_MESSAGE,
  MonthComparisonPageComponent,
  parseComparisonQuery
} from './month-comparison-page.component';

const NETWORK_FAILED = 'We could not reach the server. Check your connection and try again.';

interface Page {
  harness: RouterTestingHarness;
  root: HTMLElement;
  http: HttpTestingController;
  router: Router;
}

const text = (node: Element | null | undefined): string => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
const els = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

const isComparison =
  (endYear: number, endMonth: number, months: number) =>
  (request: HttpRequest<unknown>): boolean =>
    request.url === BUDGET_PLAN_ENDPOINTS.COMPARISON &&
    request.params.get('endYear') === String(endYear) &&
    request.params.get('endMonth') === String(endMonth) &&
    request.params.get('months') === String(months);

/** A response of `count` months ending at `end`, all without a plan except those given in `planned`. */
const responseFor = (endYear: number, endMonth: number, count: number, planned: ComparisonMonth[] = []) => {
  const months: ComparisonMonth[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const index = endYear * 12 + endMonth - 1 - offset;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push(
      planned.find((item) => item.year === year && item.month === month) ?? {
        year,
        month,
        hasPlan: false,
        monthlyIncomeVnd: '0',
        spentVnd: '0',
        percentageUsed: 0,
        jars: []
      }
    );
  }
  return { ...MONTH_COMPARISON_FIXTURE, months } satisfies MonthComparisonResponse;
};

const render = (page: Page): void => page.harness.detectChanges();

const settle = async (page: Page): Promise<void> => {
  await TestBed.inject(ApplicationRef).whenStable();
  render(page);
};

const createPage = async (url: string): Promise<Page> => {
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, MonthComparisonPageComponent);
  harness.detectChanges();
  const root = harness.routeNativeElement;
  if (root === null) {
    throw new Error('The routed page was not rendered');
  }
  return { harness, root, http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router) };
};

const respond = async (page: Page, match: (request: HttpRequest<unknown>) => boolean, act: (call: TestRequest) => void) => {
  act(page.http.expectOne(match));
  await settle(page);
};

const readyPage = async (): Promise<Page> => {
  const page = await createPage('/compare?end=2026-11&months=3');
  await respond(page, isComparison(2026, 11, 3), (call) => call.flush(MONTH_COMPARISON_FIXTURE));
  return page;
};

const select = (page: Page, id: string): HTMLSelectElement => {
  const element = page.root.querySelector<HTMLSelectElement>(`#${id}`);
  if (element === null) {
    throw new Error(`No #${id}`);
  }
  return element;
};

const change = (element: HTMLInputElement | HTMLSelectElement, value: string): void => {
  element.value = value;
  element.dispatchEvent(new Event('change'));
};

const button = (page: Page, label: string): HTMLButtonElement => {
  const found = els<HTMLButtonElement>(page.root, 'button').find(
    (item) => item.getAttribute('aria-label') === label || text(item) === label
  );
  if (!found) {
    throw new Error(`No button ${label}`);
  }
  return found;
};

const tableRows = (page: Page): string[][] =>
  els(page.root, 'tbody tr').map((row) => els(row, 'th, td').map((cell) =>
    cell.children.length > 0 && cell.tagName === 'TD' ? els(cell, 'span').map(text).join(' ') : text(cell)
  ));

describe('MonthComparisonPageComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'compare', component: MonthComparisonPageComponent },
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

  it('defaults to the 6 months ending this month', async () => {
    const page = await createPage('/compare');

    expect(text(page.root.querySelector('[role=status]'))).toBe('Loading the comparison…');
    expect(text(page.root.querySelector('.comparison-meta'))).toBe('June 2026 – November 2026 · Amounts in VND');
    await respond(page, isComparison(2026, 11, 6), (call) => call.flush(responseFor(2026, 11, 6)));
  });

  it('renders the summary, one chart column per month and the table', async () => {
    const page = await readyPage();

    expect(text(page.root.querySelector('h1'))).toBe('Compare months');
    expect(els(page.root, '.summary-card dd').map(text)).toEqual(['25,000,000 VND', '12,500,000 VND', 'November 2026']);
    expect(els(page.root, '.column-label').map(text)).toEqual(['Sep', 'Oct', 'Nov']);
    expect(els(page.root, '.column--empty')).toHaveLength(1);
    expect(els(page.root, '.column')[0].querySelectorAll('.segment')).toHaveLength(2);
    expect(page.root.querySelector('.chart')?.getAttribute('aria-hidden')).toBe('true');

    expect(els(page.root, 'thead th').map(text)).toEqual(['Jar', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Last vs previous']);
    const rows = tableRows(page);
    expect(rows).toHaveLength(8);
    expect(rows[1]).toEqual(['Food', '2,000,000 50%', 'No plan', '7,000,000 175%', '+250%']);
    expect(rows.at(-1)?.[0]).toBe('Total spent');
  });

  it('filters to one jar on the client and keeps it in the URL', async () => {
    const page = await readyPage();

    change(select(page, 'comparison-jar'), 'food');
    await settle(page);

    expect(page.router.url).toBe('/compare?end=2026-11&months=3&jar=food');
    page.http.expectNone(() => true);
    expect(tableRows(page).map((row) => row[0])).toEqual(['Food']);
    expect(els(page.root, '.legend li').map(text)).toEqual(['Food', 'Food budget']);
    expect(select(page, 'comparison-jar').value).toBe('food');

    change(select(page, 'comparison-jar'), '');
    await settle(page);
    expect(page.router.url).toBe('/compare?end=2026-11&months=3');
    expect(tableRows(page)).toHaveLength(8);
  });

  it('refetches when the range changes', async () => {
    const page = await readyPage();

    change(select(page, 'comparison-range'), '12');
    await settle(page);

    expect(page.router.url).toBe('/compare?end=2026-11&months=12');
    await respond(page, isComparison(2026, 11, 12), (call) =>
      call.flush(responseFor(2026, 11, 12, MONTH_COMPARISON_FIXTURE.months))
    );
    expect(els(page.root, '.column')).toHaveLength(12);
    expect(els(page.root, '.column-year').map(text).filter(Boolean)).toEqual(['2025', '2026']);
  });

  it('refetches when the end month changes', async () => {
    const page = await readyPage();

    change(page.root.querySelector<HTMLInputElement>('#comparison-end') as HTMLInputElement, '2026-10');
    await settle(page);

    await respond(page, isComparison(2026, 10, 3), (call) => call.flush(responseFor(2026, 10, 3)));
    expect(page.router.url).toBe('/compare?end=2026-10&months=3');
  });

  it('Earlier and Later move the window by the range length', async () => {
    const page = await readyPage();

    button(page, 'Earlier months').click();
    await settle(page);
    await respond(page, isComparison(2026, 8, 3), (call) => call.flush(responseFor(2026, 8, 3)));
    expect(page.router.url).toBe('/compare?end=2026-08&months=3');

    button(page, 'Later months').click();
    await settle(page);
    await respond(page, isComparison(2026, 11, 3), (call) => call.flush(MONTH_COMPARISON_FIXTURE));
  });

  it('offers to create a plan when the range has none', async () => {
    const page = await createPage('/compare?end=2026-11&months=3');
    await respond(page, isComparison(2026, 11, 3), (call) => call.flush(responseFor(2026, 11, 3)));

    expect(text(page.root.querySelector('.state-message'))).toBe(
      'There is no monthly plan in September 2026 – November 2026.'
    );
    expect(page.root.querySelector('a[href="/monthly-planning"]')).not.toBeNull();
    expect(page.root.querySelector('.chart')).toBeNull();
  });

  it('shows the generic message on a server error and retries', async () => {
    const page = await createPage('/compare?end=2026-11&months=3');
    await respond(page, isComparison(2026, 11, 3), (call) =>
      call.flush(INTERNAL_ERROR_FIXTURE, { status: 500, statusText: 'Internal Server Error' })
    );

    expect(text(page.root.querySelector('[role=alert] .state-message'))).toBe(COMPARISON_LOAD_FAILED_MESSAGE);

    button(page, 'Try again').click();
    render(page);
    await respond(page, isComparison(2026, 11, 3), (call) => call.flush(MONTH_COMPARISON_FIXTURE));
    expect(page.root.querySelector('[role=alert]')).toBeNull();
    expect(tableRows(page)).toHaveLength(8);
  });

  it('keeps the network message', async () => {
    const page = await createPage('/compare?end=2026-11&months=3');
    await respond(page, isComparison(2026, 11, 3), (call) => call.error(new ProgressEvent('error')));

    expect(text(page.root.querySelector('[role=alert] .state-message'))).toBe(NETWORK_FAILED);
  });

  it.each<[string, unknown]>([
    ['a null body', null],
    ['a body for another end month', responseFor(2026, 10, 3)],
    ['a body with the wrong number of months', responseFor(2026, 11, 2)],
    ['months that are not a list', { ...MONTH_COMPARISON_FIXTURE, months: {} }]
  ])('rejects %s', async (_label, body) => {
    const page = await createPage('/compare?end=2026-11&months=3');
    await respond(page, isComparison(2026, 11, 3), (call) => call.flush(body as object));

    expect(text(page.root.querySelector('[role=alert] .state-message'))).toBe(COMPARISON_INVALID_MESSAGE);
  });
});

describe('parseComparisonQuery', () => {
  const today = { year: 2026, month: 11 };

  it('reads valid values', () => {
    expect(parseComparisonQuery(convertToParamMap({ end: '2025-03', months: '12', jar: 'food' }), today)).toEqual({
      end: { year: 2025, month: 3 },
      months: 12,
      jar: 'food'
    });
  });

  it('falls back to this month, 6 months and all jars for anything invalid', () => {
    expect(parseComparisonQuery(convertToParamMap({ end: '2025-13', months: '5', jar: 'toString' }), today)).toEqual({
      end: today,
      months: 6,
      jar: null
    });
    expect(parseComparisonQuery(convertToParamMap({}), today)).toEqual({ end: today, months: 6, jar: null });
  });
});
