import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Period } from '../../../features/monthly-planning/utils/period';
import { MonthSwitcherComponent } from './month-switcher.component';

interface LinkSnapshot {
  text: string;
  href: string | null;
  ariaLabel: string | null;
}

const text = (element: Element | null): string => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const render = (period: Period, section?: string): ComponentFixture<MonthSwitcherComponent> => {
  const fixture = TestBed.createComponent(MonthSwitcherComponent);
  fixture.componentRef.setInput('period', period);
  if (section !== undefined) {
    fixture.componentRef.setInput('section', section);
  }
  fixture.detectChanges();
  return fixture;
};

const links = (fixture: ComponentFixture<MonthSwitcherComponent>): LinkSnapshot[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map((link) => ({
    text: text(link),
    href: link.getAttribute('href'),
    ariaLabel: link.getAttribute('aria-label')
  }));

const current = (fixture: ComponentFixture<MonthSwitcherComponent>): Element | null =>
  (fixture.nativeElement as HTMLElement).querySelector('[aria-current=page]');

describe('MonthSwitcherComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('renders a navigation landmark with the current month', () => {
    const fixture = render({ year: 2026, month: 9 });

    expect((fixture.nativeElement as HTMLElement).querySelector('nav')?.getAttribute('aria-label')).toBe('Change month');
    expect(text(current(fixture))).toBe('September 2026');
  });

  it('links to the previous and next plan pages when no section is given', () => {
    const fixture = render({ year: 2026, month: 9 });

    expect(links(fixture)).toEqual([
      { text: '‹ August 2026', href: '/monthly-plans/2026/8', ariaLabel: 'Previous month, August 2026' },
      { text: 'October 2026 ›', href: '/monthly-plans/2026/10', ariaLabel: 'Next month, October 2026' }
    ]);
  });

  it('keeps the section as the trailing route segment', () => {
    const fixture = render({ year: 2026, month: 9 }, 'spending');

    expect(links(fixture).map((link) => link.href)).toEqual([
      '/monthly-plans/2026/8/spending',
      '/monthly-plans/2026/10/spending'
    ]);
  });

  it('treats an empty section like no section', () => {
    const fixture = render({ year: 2026, month: 9 }, '');

    expect(links(fixture).map((link) => link.href)).toEqual(['/monthly-plans/2026/8', '/monthly-plans/2026/10']);
  });

  it('wraps across years in both directions', () => {
    const january = render({ year: 2026, month: 1 });
    expect(links(january).map((link) => [link.text, link.href])).toEqual([
      ['‹ December 2025', '/monthly-plans/2025/12'],
      ['February 2026 ›', '/monthly-plans/2026/2']
    ]);

    const december = render({ year: 2026, month: 12 }, 'spending');
    expect(links(december).map((link) => [link.text, link.href])).toEqual([
      ['‹ November 2026', '/monthly-plans/2026/11/spending'],
      ['January 2027 ›', '/monthly-plans/2027/1/spending']
    ]);
  });

  it('hides the previous link at the first supported month', () => {
    const fixture = render({ year: 1, month: 1 });

    expect(links(fixture)).toEqual([
      { text: 'February 1 ›', href: '/monthly-plans/1/2', ariaLabel: 'Next month, February 1' }
    ]);
    expect(text(current(fixture))).toBe('January 1');
  });

  it('hides the next link at the last supported month', () => {
    const fixture = render({ year: 9999, month: 12 });

    expect(links(fixture)).toEqual([
      { text: '‹ November 9999', href: '/monthly-plans/9999/11', ariaLabel: 'Previous month, November 9999' }
    ]);
  });

  it('follows input changes', () => {
    const fixture = render({ year: 2026, month: 9 });

    fixture.componentRef.setInput('period', { year: 2026, month: 10 });
    fixture.componentRef.setInput('section', 'spending');
    fixture.detectChanges();

    expect(text(current(fixture))).toBe('October 2026');
    expect(links(fixture).map((link) => link.href)).toEqual([
      '/monthly-plans/2026/9/spending',
      '/monthly-plans/2026/11/spending'
    ]);
  });
});
