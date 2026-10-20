---
name: ff-feature
description: Implement or extend one Family Finance feature (F1 monthly planning, F2 income allocation, F3 add expense, F5 spending by jar) end to end, from contract to tests. Use when asked to build, finish, or fix a feature or its page.
argument-hint: <f1|f2|f3|f5> [extra instructions]
---

# Implement feature $0

Extra instructions: $ARGUMENTS

## 1. Load context (only these)

| Arg | Brief |
|---|---|
| f1 | `.claude/knowledge/features/f1-monthly-planning.md` |
| f2 | `.claude/knowledge/features/f2-income-allocation.md` |
| f3 | `.claude/knowledge/features/f3-add-expense.md` |
| f5 | `.claude/knowledge/features/f5-spending-by-jar.md` |

Also read `.claude/knowledge/api-contract.md`. Read `domain-rules.md` / `discrepancies.md` only if the brief points there.
Open original specs only for missing detail (Grep the heading, then Read a range).

## 2. Inspect existing code

`Glob frontend/src/app/**/*` and read only files this feature touches: `app.routes.ts`, `api-endpoints.ts`, existing `core/`, `models/`, `shared/`, and this feature's folder. Reuse what exists (models, service, formatter, shell, fixtures).
If any `OPEN` item in `discrepancies.md` blocks this feature, ask the user before coding it.

## 3. Plan (short, in Vietnamese)

List the files to create or change and the risks. If the task is small and clear, continue without waiting.

## 4. Implement in order, small steps

1. Models (`src/app/models/`) and service methods plus endpoint constants: exact wire names.
2. Shared pieces needed (VND formatter pipe, shell header/sidebar, state blocks) if missing.
3. Page component logic: signals, reactive form, request states, submit guard.
4. Template and styles: delegate to the **ff-ui-builder** agent with the mockup alias, section, target paths, and bindings. Use `/ff-mockup` yourself only for a quick look.
5. Route in `app.routes.ts` and update `app.routes.spec.ts`.

## 5. Test and verify

- Delegate specs to the **ff-test-writer** agent (files plus feature id), or write them inline when small.
- Run `/ff-verify`.

## 6. Review

Run the **ff-reviewer** agent on the changed files with the feature id. Fix critical and major findings, then re-verify.

## 7. Report (Vietnamese; code and identifiers in English)

Changed files · ACs met or missing · commands run with their actual result lines · coverage · open issues and unverified behavior (for example, not tested against the live API).
