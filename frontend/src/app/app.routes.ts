import { Routes } from '@angular/router';

import { MonthlyPlanningPageComponent } from './features/monthly-planning/pages/monthly-planning-page/monthly-planning-page.component';
import { MonthlyPlanPageComponent } from './features/monthly-planning/pages/monthly-plan-page/monthly-plan-page.component';
import { MonthlyPlansListPageComponent } from './features/monthly-planning/pages/monthly-plans-list-page/monthly-plans-list-page.component';
import { AddExpensePageComponent } from './features/expenses/pages/add-expense-page/add-expense-page.component';
import { SpendingByJarPageComponent } from './features/spending-by-jar/pages/spending-by-jar-page/spending-by-jar-page.component';
import { MonthComparisonPageComponent } from './features/month-comparison/pages/month-comparison-page/month-comparison-page.component';
import { currentMonthSpendingPath } from './features/monthly-planning/utils/period';

/** There is no dashboard page: "Home" opens the current month's spending by jar. */
const currentMonthSpending = (): string => currentMonthSpendingPath().slice(1);

export const routes: Routes = [
  // The router follows one redirect per navigation, so '' cannot go via 'dashboard': both share the same target.
  { path: '', pathMatch: 'full', redirectTo: currentMonthSpending },
  { path: 'dashboard', redirectTo: currentMonthSpending },
  { path: 'monthly-planning', title: 'Create monthly plan', component: MonthlyPlanningPageComponent },
  { path: 'monthly-plans', title: 'All months', component: MonthlyPlansListPageComponent },
  { path: 'monthly-plans/:year/:month', title: 'Monthly plan', component: MonthlyPlanPageComponent },
  { path: 'monthly-plans/:year/:month/spending', title: 'Spending by jar', component: SpendingByJarPageComponent },
  { path: 'expenses/new', title: 'Add expense', component: AddExpensePageComponent },
  { path: 'compare', title: 'Compare months', component: MonthComparisonPageComponent },
  { path: '**', redirectTo: 'monthly-plans' }
];
