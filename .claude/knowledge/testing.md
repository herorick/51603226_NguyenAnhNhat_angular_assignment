# Testing (Angular 21 + Vitest, zoneless)

## Stack facts

- Builder `@angular/build:unit-test`, runner `vitest`, env `jsdom`, `watch: false`. No Karma/Jasmine, no zone.js.
- Existing specs import explicitly: `import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';`.
- **No `fakeAsync`/`tick`/`waitForAsync`** (they need zone.js). Use `await fixture.whenStable()`, or `vi.useFakeTimers()` for timers.
- Mocks: `vi.fn()`, `vi.spyOn(obj, 'method')`. Never `jasmine.createSpyObj`.
- `ng generate` skips specs (`skipTests: true`), so create `*.spec.ts` next to the file yourself.

## Commands (from repo root, no `cd`)

```bash
npm --prefix frontend ci                                                      # first time only (node_modules absent)
npm --prefix frontend test                                                    # all specs once
npm --prefix frontend test -- --include="src/app/features/expenses/**/*.spec.ts"   # subset
npm --prefix frontend test -- --coverage --coverage-reporters=text-summary    # coverage summary only
npm --prefix frontend run build                                               # prod build (catches strictTemplates + style budget)
```

Report only the summary lines (`Test Files`, `Tests`, coverage `Statements/Branches/Functions/Lines`). Target is >= 80%.
Optional gate: add `"coverageThresholds": { "statements": 80, "lines": 80, "functions": 80, "branches": 80 }` to `angular.json` test options. That edits project config, so ask first.

## Patterns

```ts
// HTTP service
TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
const http = TestBed.inject(HttpTestingController);
service.createMonthlyPlan(req).subscribe({ next, error });
const call = http.expectOne(BUDGET_PLAN_ENDPOINTS.PLANS);
expect(call.request.method).toBe('POST');
expect(call.request.body).toEqual({ year: 2026, month: 9, monthlyIncomeVnd: '25000000' });
call.flush(errorBody, { status: 409, statusText: 'Conflict' });
afterEach(() => http.verify());

// Routed page with params
providers: [provideRouter([{ path: 'monthly-plans/:year/:month', component: MonthlyPlanPageComponent }]), ...]
const harness = await RouterTestingHarness.create();
const page = await harness.navigateByUrl('/monthly-plans/2026/9', MonthlyPlanPageComponent);
harness.detectChanges();

// Network error
call.error(new ProgressEvent('error'));
```

- Query the DOM by role/text/label (`querySelector('[role=alert]')`, label `for`), not private fields.
- Put shared fixtures in `src/app/testing/fixtures.ts` (seven-jar plan, spending with zero / over-100 / negative remaining, error envelopes).

## Must-cover matrix (maps to `docs/testing/test-cases`)

- Service: each endpoint URL, method, and exact body; error envelope passthrough; no client math.
- F1: required/zero/negative/decimal/`abc` income; submit disabled while invalid or pending; double click sends one POST; 201 navigates to `/monthly-plans/y/m`; 409 shows the message and keeps values; 500/network shows retry.
- F2: loading; seven jars in response order; formatted budgets; 404 shows "Monthly plan unavailable" + link; invalid route params cause no HTTP call; retry refetches.
- F3: changing the date month loads that plan; 404 hides jars; validation per field; whitespace description rejected; one POST while saving; values kept on error; `jarSummary` rendered including negative `remainingVnd`; 400 field errors mapped to controls.
- F5: seven rows in response order; `0%` empty track; `102.86%` shown unclamped, bar capped, "Over budget" text; 404 state; retry.
- Shared: VND formatter (`"0"`, `"1"`, `"25000000"`, `"-250000"`), progress capping, routes.

Case list per feature: `python .claude/scripts/test_cases.py f1` (or `TC_F3_009` for one case).
