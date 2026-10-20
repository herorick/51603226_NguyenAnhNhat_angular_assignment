# Doc vs Code Discrepancies and Decisions

Verified 2026-10-20. Code (`backend/`) wins over specs for wire contracts. Mark a decision `OPEN` until the user confirms it.

| # | Conflict | Decision |
|---|---|---|
| 1 | There is no `docs/development/` folder. | Specs live in `docs/design/spec-{f1-f2,f3,f5}-{frontend,backend}.md`. |
| 2 | F3 spec: `POST /api/v1/budget-plans/expenses/` (trailing slash). Controller: `[HttpPost("expenses")]`. | Call `/api/v1/budget-plans/expenses`. |
| 3 | F3 spec service signature `createExpense(year, month, request)`, yet it says year/month must not be sent. | `createExpense(request: CreateExpenseRequest)`. |
| 4 | F3 AC6 "reject date outside plan month": backend derives the plan from `expenseDate`, so the server never sees a mismatch. | When the date's month changes, reload the plan for the new month, revalidate the jar, and show the missing-plan state on 404. Never reuse the old month's jars. |
| 5 | `spec-f5-*` is titled "F4 Spending by Jar". `requirements/f5-dashboard.md` and `TC_F5_*` describe a full dashboard (overall totals, remaining, recent activity) with no API for it. | Implement only the read-only Spending by Jar view at `/monthly-plans/:year/:month/spending`. Apply `TC_F5_*` only to per-jar rows. |
| 6 | `app.routes.ts` redirects `''` to `dashboard` (route commented out). `app.routes.spec.ts` asserts an exact 6-route array including `dashboard` and no spending route, so it fails today and breaks when routes are added. The sidebar "Home" links to `/dashboard`. | **Decided 2026-10-20.** Keep `''` -> `dashboard` and `**` -> `monthly-planning`. `dashboard` becomes a functional redirect to the current month's spending: `{ path: 'dashboard', redirectTo: () => { const d = new Date(); return \`monthly-plans/${d.getFullYear()}/${d.getMonth() + 1}/spending\`; } }`. Add `monthly-plans/:year/:month/spending` after `monthly-plans/:year/:month`. No dashboard page or component. Update `app.routes.spec.ts` by inserting the spending entry. |
| 7 | Specs reference `month-budget-summary.html` and `adding-expenses.html`, which do not exist. | Use the map in `ui-mockups.md`. |
| 8 | The F5 spec mock JSON lists `emergencyFund` before `children`. The backend returns canonical catalog order. | Render response order as-is. Use a non-canonical fixture in tests to prove there is no client sorting. |
| 9 | CORS allows only `http://localhost:4400`. Mockups were captured on `:4200` (the `ng serve` default). | Serve with `--port 4400` for real API calls. |
| 10 | Old CLAUDE.md said every money field is digit-only. `remainingVnd` = budget - spent can be negative. | Money regex for display: `^-?\d+$`. Request money stays `^\d+$`. |
| 11 | Old CLAUDE.md suggested `features/income-allocation/` etc. The trainer's commented route skeleton uses `features/<area>/pages/<page>/<page>.component.ts` with a `*PageComponent` class. | **Decided.** Follow the skeleton: F1 `features/monthly-planning/pages/monthly-planning-page`, F2 `features/monthly-planning/pages/monthly-plan-page`, F3 `features/expenses/pages/add-expense-page`, F5 `features/spending-by-jar/pages/spending-by-jar-page`. Generate with `--type=component` to keep the suffix. |
| 12 | `architecture.md` says rounding is unresolved. Backend already implements largest-remainder (`BudgetAllocator.cs`). | Irrelevant to the frontend. Render backend values. |
| 13 | `backend/FamilyFinance.Api/README.md` POST example uses old fields (`monthlyIncome`, `allocations`). | Stale. Ignore it. |
| 14 | Requirement traceability says `product-brief.md` is missing. | It exists at `docs/product-brief.md`. It mentions expense edit/delete and a full dashboard, but no API exists for either, so both are out of scope. |
| 15 | `angular.json` schematics set `skipTests: true`. | `ng generate` creates no spec files. Write `*.spec.ts` by hand. |
