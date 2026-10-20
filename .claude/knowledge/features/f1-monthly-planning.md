# F1 Monthly Planning: `/monthly-planning`

Sources: `docs/requirements/f1-monthly-planning/f1-monthly-planning.md` (AC1-AC5), `docs/design/spec-f1-f2-frontend.md`.
Mockup: `f1-monthly-planning/f1-monthly-planning.html` (use `mock_html.py`). Test cases: `test_cases.py f1`.
Location: `features/monthly-planning/pages/monthly-planning-page/`.

## Flow

1. On init, call `getDefaultJars()` once. Show loading; create stays disabled until loaded. On failure show a retry action.
2. Render the seven read-only default jars (name, rate, `suggestedLogic`) in response order, plus "100% allocated" from `totalPercentage`.
3. Reactive form: `period` (`<input type="month">`, value `YYYY-MM`, split into year/month numbers) and `monthlyIncomeVnd` (text, `VND` suffix, `inputmode="numeric"`).
4. Submit guard: `if (form.invalid || submitting()) return;`, mark all touched, focus the first invalid control.
5. `createMonthlyPlan({ year, month, monthlyIncomeVnd })` with normalized digits. Use `finalize` to release `submitting`.
6. 201: `router.navigate(['/monthly-plans', year, month])`.
7. 409 `MONTHLY_PLAN_ALREADY_EXISTS`: show the server message, keep values, link to `/monthly-plans/y/m`. No replace or edit.
8. 400: map `errors[].field` (`year`, `month`, `monthlyIncomeVnd`) to controls. 500/network: show a generic error and keep values.

## Validation

- Period required, year 1-9999, month 1-12.
- Income required. After removing display grouping (`,`), it must match `^\d+$` and not be all zeros. Reject `-1`, `1.5`, `abc`, and `0`. No `Number()` on the value.
- Error copy: "Select a month for this plan.", "Income must be a positive whole-VND amount."

## Done when

AC1 form controls visible; AC2 valid create navigates; AC3 bad income blocked with a message; AC4 duplicate message with values kept; AC5 seven backend defaults shown. All states have tests.
