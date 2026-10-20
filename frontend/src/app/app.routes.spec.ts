import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { routes } from './app.routes';
import { AddExpensePageComponent } from './features/expenses/pages/add-expense-page/add-expense-page.component';
import { MonthlyPlanPageComponent } from './features/monthly-planning/pages/monthly-plan-page/monthly-plan-page.component';
import { MonthlyPlanningPageComponent } from './features/monthly-planning/pages/monthly-planning-page/monthly-planning-page.component';
import { SpendingByJarPageComponent } from './features/spending-by-jar/pages/spending-by-jar-page/spending-by-jar-page.component';

// Stand-ins for pages that other features add later, so redirects can be followed to their target.
const redirectTargets: Routes = [
  { path: 'monthly-plans/:year/:month/spending', children: [] },
  { path: 'monthly-planning', children: [] }
];

const navigateTo = async (url: string): Promise<string> => {
  TestBed.configureTestingModule({
    providers: [provideRouter([...redirectTargets, ...routes.filter((route) => route.component === undefined)])]
  });
  await RouterTestingHarness.create(url);
  return TestBed.inject(Router).url;
};

describe('routes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defines the application navigation routes', () => {
    expect(routes).toEqual([
      expect.objectContaining({ path: '', pathMatch: 'full', redirectTo: expect.any(Function) }),
      expect.objectContaining({ path: 'dashboard', redirectTo: expect.any(Function) }),
      expect.objectContaining({ path: 'monthly-planning', component: MonthlyPlanningPageComponent }),
      expect.objectContaining({ path: 'monthly-plans/:year/:month', component: MonthlyPlanPageComponent }),
      expect.objectContaining({ path: 'monthly-plans/:year/:month/spending', component: SpendingByJarPageComponent }),
      expect.objectContaining({ path: 'expenses/new', component: AddExpensePageComponent }),
      expect.objectContaining({ path: '**', redirectTo: 'monthly-planning' })
    ]);
  });

  it.each(['/', '/dashboard'])('redirects %s to the current month spending route', async (url) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 15));

    expect(await navigateTo(url)).toBe('/monthly-plans/2026/9/spending');
  });

  it('falls back to monthly planning for unknown urls', async () => {
    expect(await navigateTo('/unknown-page')).toBe('/monthly-planning');
  });
});
