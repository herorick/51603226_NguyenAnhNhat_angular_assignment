import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FamilyFinanceHeaderComponent } from './family-finance-header.component';

@Component({
  imports: [FamilyFinanceHeaderComponent, RouterOutlet],
  template: '<app-family-finance-header /><router-outlet />'
})
class ShellComponent {}

@Component({ template: '' })
class StubPageComponent {}

describe('FamilyFinanceHeaderComponent', () => {
  let harness: RouterTestingHarness;

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const brand = (): HTMLAnchorElement => root().querySelector<HTMLAnchorElement>('header a') as HTMLAnchorElement;
  const account = (): HTMLButtonElement =>
    root().querySelector<HTMLButtonElement>('header button') as HTMLButtonElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: ShellComponent,
            children: [
              { path: 'monthly-planning', component: StubPageComponent },
              { path: 'expenses/new', component: StubPageComponent }
            ]
          }
        ])
      ]
    });
    harness = await RouterTestingHarness.create('/expenses/new');
    await harness.fixture.whenStable();
    harness.detectChanges();
  });

  it('renders a header landmark', () => {
    expect(root().querySelector('header')).not.toBeNull();
  });

  it('renders the brand as a link to /monthly-planning with an accessible name', () => {
    expect(brand().getAttribute('href')).toBe('/monthly-planning');
    expect(brand().textContent).toContain('Family Finance');
    expect(brand().getAttribute('aria-label')).toBe('Family Finance home');
  });

  it('hides the decorative brand mark from assistive technology', () => {
    expect(root().querySelector('.brand-mark')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('navigates to /monthly-planning when the brand is clicked', async () => {
    expect(TestBed.inject(Router).url).toBe('/expenses/new');

    brand().click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/monthly-planning');
  });

  it('renders the placeholder account button with the family name and initials', () => {
    expect(root().querySelectorAll('header button')).toHaveLength(1);
    expect(account().type).toBe('button');
    expect(account().querySelector('.user-name')?.textContent?.trim()).toBe('Family Name');
    expect(account().querySelector('.avatar')?.textContent?.trim()).toBe('FN');
    expect(account().textContent).toContain('Family Name');
    expect(account().textContent).toContain('FN');
  });

  it('does not announce a menu that does not exist and hides the avatar from assistive technology', () => {
    expect(account().hasAttribute('aria-haspopup')).toBe(false);
    expect(account().hasAttribute('aria-expanded')).toBe(false);
    expect(account().querySelector('.avatar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not submit or navigate when the account button is clicked (no auth in scope)', async () => {
    account().click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/expenses/new');
  });
});
