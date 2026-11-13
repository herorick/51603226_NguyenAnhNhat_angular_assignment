import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FamilyFinanceSidebarComponent } from './family-finance-sidebar.component';

@Component({
  imports: [FamilyFinanceSidebarComponent, RouterOutlet],
  template: '<app-family-finance-sidebar /><router-outlet />'
})
class ShellComponent {}

@Component({ template: '' })
class StubPageComponent {}

const HOME = '/monthly-plans/2026/9/spending';

describe('FamilyFinanceSidebarComponent', () => {
  let harness: RouterTestingHarness;

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const links = (): HTMLAnchorElement[] => Array.from(root().querySelectorAll<HTMLAnchorElement>('nav a'));
  const linkByText = (text: string): HTMLAnchorElement => {
    const link = links().find((anchor) => anchor.textContent?.trim() === text);
    if (!link) {
      throw new Error(`No sidebar link with text "${text}"`);
    }
    return link;
  };
  const activeLabels = (): string[] =>
    links()
      .filter((anchor) => anchor.getAttribute('aria-current') === 'page')
      .map((anchor) => anchor.textContent?.trim() ?? '');

  const navigate = async (url: string): Promise<void> => {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 15));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: ShellComponent,
            children: [
              { path: 'dashboard', redirectTo: HOME.slice(1) },
              { path: 'monthly-planning', component: StubPageComponent },
              { path: 'monthly-plans', component: StubPageComponent },
              { path: 'expenses/new', component: StubPageComponent },
              { path: 'compare', component: StubPageComponent },
              { path: 'monthly-plans/:year/:month', component: StubPageComponent },
              { path: 'monthly-plans/:year/:month/spending', component: StubPageComponent },
              { path: 'other', component: StubPageComponent }
            ]
          }
        ])
      ]
    });
    harness = await RouterTestingHarness.create('/monthly-planning');
    await harness.fixture.whenStable();
    harness.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a primary navigation landmark', () => {
    const nav = root().querySelector('nav');

    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Primary navigation');
  });

  it('renders the four links in order', () => {
    expect(links().map((anchor) => anchor.textContent?.trim())).toEqual([
      'Home',
      'All months',
      'Create plan',
      'Add Expense',
      'Compare'
    ]);
  });

  it('points each link at its route; Home goes straight to the current month spending (no redirect)', () => {
    expect(linkByText('Home').getAttribute('href')).toBe(HOME);
    expect(linkByText('All months').getAttribute('href')).toBe('/monthly-plans');
    expect(linkByText('Create plan').getAttribute('href')).toBe('/monthly-planning');
    expect(linkByText('Add Expense').getAttribute('href')).toBe('/expenses/new');
    expect(linkByText('Compare').getAttribute('href')).toBe('/compare');
  });

  it('hides decorative icons from assistive technology', () => {
    const icons = root().querySelectorAll('nav .nav-icon');

    expect(icons).toHaveLength(5);
    icons.forEach((icon) => expect(icon.getAttribute('aria-hidden')).toBe('true'));
  });

  it('marks only Create plan as the current page on /monthly-planning', () => {
    expect(activeLabels()).toEqual(['Create plan']);
    expect(linkByText('Create plan').classList).toContain('active');
    expect(linkByText('Home').hasAttribute('aria-current')).toBe(false);
  });

  it('highlights Home on the current month spending page, also when reached through /dashboard', async () => {
    await navigate(HOME);
    expect(activeLabels()).toEqual(['Home']);

    await navigate('/expenses/new');
    expect(activeLabels()).toEqual(['Add Expense']);

    await navigate('/compare?months=12');
    expect(activeLabels()).toEqual(['Compare']);

    await navigate('/dashboard');
    expect(TestBed.inject(Router).url).toBe(HOME);
    expect(activeLabels()).toEqual(['Home']);
  });

  it('highlights All months on the overview and on any other month page', async () => {
    await navigate('/monthly-plans');
    expect(activeLabels()).toEqual(['All months']);

    await navigate('/monthly-plans/2026/8');
    expect(activeLabels()).toEqual(['All months']);

    await navigate('/monthly-plans/2026/8/spending');
    expect(activeLabels()).toEqual(['All months']);
  });

  it('marks no item active on a route that is not in the navigation', async () => {
    await navigate('/other');

    expect(activeLabels()).toEqual([]);
    expect(links().filter((anchor) => anchor.classList.contains('active'))).toHaveLength(0);
  });

  it('navigates when a link is clicked and updates the active item', async () => {
    linkByText('All months').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/monthly-plans');
    expect(activeLabels()).toEqual(['All months']);
  });
});
