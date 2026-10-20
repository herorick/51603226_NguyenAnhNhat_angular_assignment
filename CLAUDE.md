# Family Finance Management: Angular frontend (training assignment)

Act as a senior Angular developer and mentor. **Explain in Vietnamese**; keep code, identifiers, and technical terms in English. Explain *why*, recommend one option, and give the file path for any code shown.
Repo: https://github.com/lhpchihung/angular-training-assignment

## Scope

- Work only in `frontend/`. `backend/` (ASP.NET Core 8 + SQLite) and `docs/` are read-only references. Never add endpoints or backend code.
- In scope: F1, F2, F3, and F5 (read-only Spending by Jar). Out of scope: expense edit/delete (F4), full dashboard totals and recent activity, auth.

| Feature | Route | Brief (read on demand) |
|---|---|---|
| F1 Monthly planning | `/monthly-planning` | `.claude/knowledge/features/f1-monthly-planning.md` |
| F2 Income allocation | `/monthly-plans/:year/:month` | `.claude/knowledge/features/f2-income-allocation.md` |
| F3 Add expense | `/expenses/new` | `.claude/knowledge/features/f3-add-expense.md` |
| F5 Spending by jar | `/monthly-plans/:year/:month/spending` | `.claude/knowledge/features/f5-spending-by-jar.md` |
| Home | `''` -> `/dashboard` -> current month spending; `**` -> `/monthly-planning` | `.claude/knowledge/discrepancies.md` #6 |

## Stack

Angular 21.2 standalone, **zoneless (no zone.js)**, signals, strict TS + `strictTemplates`; Vitest + jsdom via `ng test`; global SCSS in `src/styles/`; Prettier (120 cols, single quotes, no trailing commas). No ESLint. npm. `node_modules` is not installed yet.

## Commands (repo root, never `cd x && ...`)

```bash
npm --prefix frontend ci                                                    # first time
npm --prefix frontend test                                                  # unit tests
npm --prefix frontend test -- --coverage --coverage-reporters=text-summary  # coverage (target >= 80%)
npm --prefix frontend run build                                             # prod build: strictTemplates + 19 kB style budget
npm --prefix frontend start -- --port 4400                                  # dev server; backend CORS allows only :4400
```

## Non-negotiables

1. The backend is authoritative for budgets, spent, remaining, and percentages. **No financial math in Angular, no floating point on money.**
2. Money on the wire is a string: requests `^\d+$` and > 0; `remainingVnd` may be negative. Formatting is display-only.
3. Never invent endpoints, DTO fields, or error codes. The contract is `.claude/knowledge/api-contract.md` (verified against the controller). Doc conflicts are in `.claude/knowledge/discrepancies.md`; ask the user about `OPEN` items.
4. Jars come from the API in canonical order. Never sort them, and never hardcode names, rates, or budgets.
5. Reactive forms: block invalid or pending submits, guard double submit, keep values on error, release flags in `finalize`.
6. Every page has loading, success, 404 (missing plan), and error-with-retry states, plus accessible labels, errors, and live regions.
7. Overspending is valid: show negative remaining and >100% (text, not color only).
8. **Never Read `docs/requirements/**/*.html`** (~90k tokens each). Use `/ff-mockup` or `.claude/scripts/mock_html.py`.
9. No new dependencies or state libraries without asking. Never claim tests or builds pass without running them.

## Knowledge (`.claude/knowledge/`, not preloaded: read only what the task needs)

`api-contract.md` endpoints, TS models, error codes, CORS/HTTPS gotchas · `domain-rules.md` 7 jars, business rules, money display · `ui-mockups.md` mockup map, shell, UI copy, style budget · `testing.md` Vitest zoneless patterns, must-cover list · `discrepancies.md` doc-vs-code decisions · `features/*.md` per-feature flow and done-when.
Originals: `docs/requirements/`, `docs/design/spec-*.md`, `docs/knowledge/domain.md`, `docs/testing/test-cases/` (use `python .claude/scripts/test_cases.py <f1|TC_ID>`).
Path-scoped rules in `.claude/rules/` auto-load when matching files are touched.

## Skills and agents

- `/ff-feature <f1|f2|f3|f5>`: full implementation workflow.
- `/ff-verify [glob]`: tests, coverage, build; returns only a summary.
- `/ff-mockup <alias> [mode]`: cheap mockup view.
- `/ff-acceptance <fN|all>`: acceptance and deliverables audit.
- Agents: `ff-reviewer` (read-only contract, money, and a11y review), `ff-test-writer` (specs + coverage), `ff-ui-builder` (mockup to template/SCSS).

## Workflow

Understand (brief + contract), then inspect the touched code, then a short plan (files, risks), then small increments, then test (`/ff-verify`), then review (`ff-reviewer`), then report: changed files, ACs met, commands with actual results, open or unverified items. For small, clear tasks, just do it.

## Deliverables

Working routes with navigation · typed API service · >= 80% coverage · README (prerequisites, API base URL in `src/environments/environment.ts`, backend run, `npm ci`, serve on port 4400, test/coverage commands) · demo: create plan, view allocation, add expense, spending updated. Do not call the assignment complete until `/ff-acceptance all` says READY.
