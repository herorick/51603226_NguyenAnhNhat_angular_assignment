import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FamilyFinanceHeaderComponent } from './family-finance-header.component';

@Component({
  imports: [FamilyFinanceHeaderComponent, RouterOutlet],
  template: '<app-family-finance-header /><p class="outside">outside</p><router-outlet />'
})
class ShellComponent {}

@Component({ template: '' })
class StubPageComponent {}

const HOME = '/monthly-plans/2026/9/spending';

describe('FamilyFinanceHeaderComponent', () => {
  let harness: RouterTestingHarness;

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const brand = (): HTMLAnchorElement => root().querySelector<HTMLAnchorElement>('header a.brand') as HTMLAnchorElement;
  const account = (): HTMLButtonElement =>
    root().querySelector<HTMLButtonElement>('header button.account-trigger') as HTMLButtonElement;
  const panel = (): HTMLElement => root().querySelector<HTMLElement>('#account-menu-panel') as HTMLElement;
  const menuLinks = (): HTMLAnchorElement[] => Array.from(panel().querySelectorAll<HTMLAnchorElement>('a'));
  const render = async (): Promise<void> => {
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
              { path: 'monthly-planning', component: StubPageComponent },
              { path: 'monthly-plans', component: StubPageComponent },
              { path: 'monthly-plans/:year/:month/spending', component: StubPageComponent },
              { path: 'expenses/new', component: StubPageComponent }
            ]
          }
        ])
      ]
    });
    harness = await RouterTestingHarness.create('/expenses/new');
    await render();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a header landmark', () => {
    expect(root().querySelector('header')).not.toBeNull();
  });

  it('renders the brand as a link home (current month spending) with an accessible name', () => {
    expect(brand().getAttribute('href')).toBe(HOME);
    expect(brand().textContent).toContain('Family Finance');
    expect(brand().getAttribute('aria-label')).toBe('Family Finance home');
  });

  it('navigates home when the brand is clicked', async () => {
    brand().click();
    await render();

    expect(TestBed.inject(Router).url).toBe(HOME);
  });

  it('renders the account button with the family name and initials, avatar hidden from assistive technology', () => {
    expect(account().type).toBe('button');
    expect(account().querySelector('.user-name')?.textContent?.trim()).toBe('Family Name');
    expect(account().querySelector('.avatar')?.textContent?.trim()).toBe('FN');
    expect(account().querySelector('.avatar')?.getAttribute('aria-hidden')).toBe('true');
    expect(account().getAttribute('aria-controls')).toBe('account-menu-panel');
  });

  it('starts with the menu closed', () => {
    expect(account().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hidden).toBe(true);
  });

  it('opens and closes the menu when the account button is clicked', async () => {
    account().click();
    await render();
    expect(account().getAttribute('aria-expanded')).toBe('true');
    expect(panel().hidden).toBe(false);
    expect(menuLinks().map((link) => link.textContent?.trim())).toEqual([
      "This month's spending",
      'All months',
      'Create monthly plan',
      'Add expense',
      'Compare months'
    ]);

    account().click();
    await render();
    expect(account().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hidden).toBe(true);
  });

  it('closes on Escape and returns focus to the account button', async () => {
    account().click();
    await render();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await render();

    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(account());
  });

  it('closes on a click outside the header but not on a click inside the panel', async () => {
    account().click();
    await render();

    panel().querySelector<HTMLElement>('.account-summary')?.click();
    await render();
    expect(panel().hidden).toBe(false);

    root().querySelector<HTMLElement>('.outside')?.click();
    await render();
    expect(panel().hidden).toBe(true);
  });

  it('navigates from a menu link and closes the menu', async () => {
    account().click();
    await render();

    menuLinks()
      .find((link) => link.textContent?.trim() === 'All months')
      ?.click();
    await render();

    expect(TestBed.inject(Router).url).toBe('/monthly-plans');
    expect(panel().hidden).toBe(true);
  });
});
