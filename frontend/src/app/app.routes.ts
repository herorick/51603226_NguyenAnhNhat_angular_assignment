import { Routes } from '@angular/router';

import { MonthlyPlanningPageComponent } from './features/monthly-planning/pages/monthly-planning-page/monthly-planning-page.component';
import { MonthlyPlanPageComponent } from './features/monthly-planning/pages/monthly-plan-page/monthly-plan-page.component';
import { AddExpensePageComponent } from './features/expenses/pages/add-expense-page/add-expense-page.component';
import { SpendingByJarPageComponent } from './features/spending-by-jar/pages/spending-by-jar-page/spending-by-jar-page.component';

/** There is no dashboard page: "Home" opens the current month's spending by jar. */
const currentMonthSpending = (): string => {
  const today = new Date();
  return `monthly-plans/${today.getFullYear()}/${today.getMonth() + 1}/spending`;
};

export const routes: Routes = [
  // The router follows one redirect per navigation, so '' cannot go via 'dashboard': both share the same target.
  { path: '', pathMatch: 'full', redirectTo: currentMonthSpending },
  { path: 'dashboard', redirectTo: currentMonthSpending },
  { path: 'monthly-planning', title: 'Monthly planning', component: MonthlyPlanningPageComponent },
  { path: 'monthly-plans/:year/:month', title: 'Monthly plan', component: MonthlyPlanPageComponent },
  { path: 'monthly-plans/:year/:month/spending', title: 'Spending by jar', component: SpendingByJarPageComponent },
  { path: 'expenses/new', title: 'Add expense', component: AddExpensePageComponent },
  { path: '**', redirectTo: 'monthly-planning' }
];
