---
name: ff-acceptance
description: Audit Family Finance acceptance criteria against the code and tests and return a met/partial/missing table with evidence. Use for "is F3 done?", before a demo or submission, or with "all" for the final deliverables checklist.
argument-hint: <f1|f2|f3|f5|all>
context: fork
agent: ff-reviewer
---

Acceptance audit for: `$ARGUMENTS`.

Per feature (`f1|f2|f3|f5`):
1. Read the brief in `.claude/knowledge/features/` ("Flow" and "Done when"). Read the AC list via Grep `^### AC` in `docs/requirements/<feature folder>/*.md`.
2. List test cases with `python .claude/scripts/test_cases.py <feature>`.
3. For each AC and each listed UI state, find the implementing code and the spec that tests it.
4. Output `AC/state | met/partial/missing | code path:line | test path:line`, then the top gaps.

For `all`, run the per-feature audit for f1, f2, f3, f5 (one compact table each), then check:
- Routes in `frontend/src/app/app.routes.ts`: `/monthly-planning`, `/monthly-plans/:year/:month`, `/expenses/new`, `/monthly-plans/:year/:month/spending`, plus navigation links between them.
- Typed `BudgetPlanApiService` covers all 5 endpoints, with no `any`.
- `README.md`: prerequisites, API base URL config (`environment.ts`), backend start, `npm ci`, `ng serve --port 4400` (CORS), test and coverage commands, demo flow.
- Coverage: run `npm --prefix frontend test -- --coverage --coverage-reporters=text-summary`. Target is >= 80%.
- Demo flow possible: create plan, view allocation, add expense, spending updated.
- `OPEN` items still unresolved in `.claude/knowledge/discrepancies.md`.

Verdict line: `READY` only if every AC is met and coverage >= 80% was seen in actual output. Otherwise `NOT READY: <top 3 blockers>`.
