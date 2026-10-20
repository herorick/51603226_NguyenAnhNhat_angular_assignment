import { Routes } from '@angular/router';

// import { MonthlyPlanPageComponent } from './features/monthly-planning/pages/monthly-plan-page/monthly-plan-page.component';
// import { MonthlyPlanningPageComponent } from './features/monthly-planning/pages/monthly-planning-page/monthly-planning-page.component';
// import { DashboardPageComponent } from './features/dashboard/pages/dashboard-page/dashboard-page.component';
// import { AddExpensePageComponent } from './features/expenses/pages/add-expense-page/add-expense-page.component';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
	// { path: 'dashboard', component: DashboardPageComponent },
	// { path: 'monthly-planning', component: MonthlyPlanningPageComponent },
	// { path: 'monthly-plans/:year/:month', component: MonthlyPlanPageComponent },
	// { path: 'expenses/new', component: AddExpensePageComponent },
	{ path: '**', redirectTo: 'monthly-planning' }
];
