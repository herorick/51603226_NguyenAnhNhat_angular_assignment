import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FamilyFinanceSidebarComponent } from './family-finance-sidebar.component';

@Component({
  imports: [FamilyFinanceSidebarComponent, RouterOutlet],
  template: '<app-family-finance-sidebar /><router-outlet />'
})
class ShellComponent {}

@Component({ template: '' })
class StubPageComponent {}

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
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: ShellComponent,
            children: [
              { path: 'dashboard', component: StubPageComponent },
              { path: 'monthly-planning', component: StubPageComponent },
              { path: 'expenses/new', component: StubPageComponent },
              { path: 'monthly-plans/:year/:month', component: StubPageComponent },
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

  it('renders a primary navigation landmark', () => {
    const nav = root().querySelector('nav');

    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Primary navigation');
  });

  it('renders exactly three links in order: Home, Planning, Add Expense', () => {
    expect(links().map((anchor) => anchor.textContent?.trim())).toEqual(['Home', 'Planning', 'Add Expense']);
  });

  it('points each link at its route', () => {
    expect(linkByText('Home').getAttribute('href')).toBe('/dashboard');
    expect(linkByText('Planning').getAttribute('href')).toBe('/monthly-planning');
    expect(linkByText('Add Expense').getAttribute('href')).toBe('/expenses/new');
  });

  it('hides decorative icons from assistive technology', () => {
    const icons = root().querySelectorAll('nav .nav-icon');

    expect(icons).toHaveLength(3);
    icons.forEach((icon) => expect(icon.getAttribute('aria-hidden')).toBe('true'));
  });

  it('marks only Planning as the current page on /monthly-planning (text-visible via aria-current, not color only)', () => {
    expect(activeLabels()).toEqual(['Planning']);
    expect(linkByText('Planning').classList).toContain('active');
    expect(linkByText('Home').classList).not.toContain('active');
    expect(linkByText('Add Expense').classList).not.toContain('active');
    expect(linkByText('Home').hasAttribute('aria-current')).toBe(false);
  });

  it('moves the active item when the route changes', async () => {
    await navigate('/expenses/new');
    expect(activeLabels()).toEqual(['Add Expense']);
    expect(linkByText('Planning').classList).not.toContain('active');
    expect(linkByText('Add Expense').classList).toContain('active');

    await navigate('/dashboard');
    expect(activeLabels()).toEqual(['Home']);
    expect(linkByText('Add Expense').classList).not.toContain('active');
  });

  it('marks no item active on a route that is not in the navigation', async () => {
    await navigate('/other');

    expect(activeLabels()).toEqual([]);
    expect(links().filter((anchor) => anchor.classList.contains('active'))).toHaveLength(0);
  });

  it('does not treat /monthly-plans/:year/:month as the Planning item (different path segment)', async () => {
    await navigate('/monthly-plans/2026/9');

    expect(linkByText('Planning').classList).not.toContain('active');
    expect(linkByText('Planning').hasAttribute('aria-current')).toBe(false);
  });

  it('navigates when a link is clicked and updates the active item', async () => {
    linkByText('Add Expense').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/expenses/new');
    expect(activeLabels()).toEqual(['Add Expense']);
  });
});
