# F2 Income Allocation: `/monthly-plans/:year/:month`

Sources: `docs/requirements/f2-income-allocation/f2-income-allocation.md` (AC1-AC4), `docs/design/spec-f1-f2-frontend.md`.
Mockups: `f2-income-allocation/f2-income-allocation.html` (success) and `f1-monthly-planning/f1-monthly-planning-unavailble.html` (404). Test cases: `test_cases.py f2`.
Location: `features/monthly-planning/pages/monthly-plan-page/`. Read-only page.

## Flow

1. Read `year`/`month` from `paramMap`. If either is not an integer in range (1-9999 / 1-12), show the invalid-period state and make no HTTP call.
2. `getMonthlyPlan(year, month)` shows a stable loading state with no zero placeholders.
3. 200: render "Month Budget Summary", "Monthly plan for {Month YYYY}", formatted `monthlyIncomeVnd`, a donut/legend from `jars[].percentage`, and seven jar cards (name, rate, formatted `budgetVnd`) in response order.
4. 404 `MONTHLY_PLAN_NOT_FOUND`: "Monthly plan unavailable" plus a "Create a plan" link to `/monthly-planning`. No defaults and no zero budgets.
5. 500/network/malformed: generic message plus a Retry button that re-calls the GET.
6. Reload when route params change (use `paramMap` with `switchMap`; no stale responses).
7. Navigation: back to `/monthly-planning`, "View spending" to `/monthly-plans/y/m/spending`, "Add expense" to `/expenses/new?expenseDate=YYYY-MM-01`.

## Rules

- Never compute budgets, totals, or percentages. Donut segments use backend `percentage` values for visual only.
- Optional shape check: `currency === 'VND'`, 7 unique jar types, money matches `^\d+$`. If it fails, show a data-integrity error and render no partial amounts.

## Done when

AC1 seven jars with budgets; AC2 whole-VND values shown as returned; AC3 missing plan shows no amounts; AC4 backend values only. Loading, 404, error, and retry are tested.
