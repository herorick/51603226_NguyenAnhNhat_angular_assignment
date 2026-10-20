# F3 Add Expense: `/expenses/new`

Sources: `docs/requirements/f3-add-expenses/f3-add-expenses.md` (AC1-AC6), `docs/design/spec-f3-frontend.md`.
Mockup: `f3-add-expenses/f3-add-expenses.html`. Test cases: `test_cases.py f3`.
Location: `features/expenses/pages/add-expense-page/`.

## Flow

1. Form: `expenseDate` (`<input type="date">`, `YYYY-MM-DD`), `jarType` (`<select>`), `amountVnd` (text + `VND` suffix), `description`.
2. Optional query params `expenseDate` and `jarType` (the dashboard links to `?expenseDate=2026-04-01`). Preselect only if valid for the loaded plan.
3. On `expenseDate` valueChanges, derive year/month and load the plan if the month changed: `distinctUntilChanged` on `y-m`, then `switchMap(getMonthlyPlan)`. While loading, disable jar and save.
4. 200: jar options come only from `plan.jars` (label `{name} · {percentage}%`). If the selected jar is not in the new plan, reset it.
5. 404: "Create a monthly plan before adding an expense" plus a link to `/monthly-planning`. Clear the jar options. Never reuse the previous month's jars.
6. Submit guard (invalid or saving returns early). Send `{ expenseDate, jarType, amountVnd: normalizedDigits, description: description.trim() }` to `createExpense(request)` and release `saving` in `finalize`.
7. 201: show a success live region, then the "Selected jar" panel with `jarSummary` (budget, spent, remaining) as returned. Negative remaining is valid: show it with an "Over budget" text label.
8. 400 `VALIDATION_ERROR`: map `errors[].field` to controls. 400 `JAR_NOT_IN_MONTHLY_PLAN`: show a jar error and reload the plan. 404: missing-plan state. 500/network: generic retry message. Keep all values in every error case, and never auto-retry the POST.

## Validation

- Date required and must be a real calendar date. Jar required and in the plan.
- Amount: `^\d+$` after removing grouping, not all zeros. Copy: "Enter a positive whole-VND amount." / "Amount must be greater than zero."
- Description: `trim()` non-empty, max 500. Copy: "Description is required."
- "Please select a jar." for a missing jar.

## Done when

AC1 jars only from the date's plan; AC2 save shows backend totals; AC3/AC4 validation; AC5 no cross-month jars; AC6 date month drives the plan (see `discrepancies.md` #4). All states are tested.
