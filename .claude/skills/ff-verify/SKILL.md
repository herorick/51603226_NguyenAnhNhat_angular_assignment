---
name: ff-verify
description: Run Family Finance frontend unit tests, coverage, and production build, and return only a compact summary (pass/fail counts, failing tests with first error line, coverage %, build errors). Use after code changes, or when asked whether tests, coverage, or the build pass.
argument-hint: "[spec glob] [--no-build]"
context: fork
agent: general-purpose
model: haiku
allowed-tools:
  - Bash(npm --prefix frontend *)
  - Read
  - Grep
---

Verify the Angular frontend. Arguments: `$ARGUMENTS` (optional spec glob, optional `--no-build`).

Run from the repo root. Never `cd`. Never paste full logs.

1. If `frontend/node_modules` is missing, run `npm --prefix frontend install`.
2. Tests:
   - With a spec glob: `npm --prefix frontend test -- --include="<glob>"`.
   - Without one: `npm --prefix frontend test -- --coverage --coverage-reporters=text-summary`.
3. Unless `--no-build`: `npm --prefix frontend run build`. This catches `strictTemplates` errors and the 19 kB component-style budget.
4. If a command fails, quote only the first decisive error lines per failure.

Return exactly this shape (max ~25 lines):

```
TESTS: <passed>/<total> files, <passed>/<total> tests  (verbatim summary line)
FAILING:
- <spec file> > <test name>: <first assertion/error line>
COVERAGE: Statements x% | Branches x% | Functions x% | Lines x%  (target 80%)
BUILD: ok | failed: <file:line error>
COMMANDS: <each command run + exit code>
```

Write `not run` for skipped steps. Never claim a pass that you did not see in the output.
