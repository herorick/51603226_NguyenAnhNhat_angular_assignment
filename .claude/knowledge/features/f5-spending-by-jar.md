# F5 Spending by Jar: `/monthly-plans/:year/:month/spending`

Sources: `docs/design/spec-f5-frontend.md` (titled "F4"; read-only view), `spec-f5-backend.md`.
Visual: the "Updated spending statistics" section of `f5-dashboard/f5-dashboard.html` (`mock_html.py ... css --grep refreshed`).
Test cases: `test_cases.py f5`. They target the full dashboard, so apply only the per-jar ones (`discrepancies.md` #5).
Location: `features/spending-by-jar/pages/spending-by-jar-page/`.

## Flow

1. Validate the route `year`/`month` (same as F2). If invalid, make no call and show the invalid state or redirect to `/monthly-planning`.
2. Call `getSpendingByJars(year, month)` once (never one request per jar). The loading state reserves seven skeleton rows.
3. 200: heading "Spending by jar", period context, `VND`. Render exactly `jars.length === 7` rows in response order. If the count is not 7, show a data-integrity error with retry.
4. Row: `jarName`, progress bar, `{spent} / {planned} VND`, `{percentageUsed}%` (at most 2 decimals, never clamped).
5. Progress width = `Math.min(percentageUsed, 100)`%. When `percentageUsed > 100`, add an over-budget class plus the visible text "Over budget". Zero shows an empty track and `0%`.
6. Accessible bar: `role="progressbar"`, `aria-valuenow`, plus an `aria-label` with jar name, spent, planned, and percent.
7. 404: "no monthly plan for this period" plus a link to `/monthly-planning`. 500/network: retry.
8. Fresh data: always refetch on navigation (no caching) so newly created expenses show up.

## Rules

No sorting, no client percentage math, no expense edit/delete controls.

## Done when

Seven rows in API order; planned/spent formatted; backend % shown; over-budget is visible without relying on color; zero-spend rows correct; 404/error/retry; usable on mobile. All tested.
