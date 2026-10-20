---
paths:
  - "docs/**"
  - "backend/**"
---

# Reference material: read-only

- `docs/` and `backend/` are trainer-provided sources of truth. Do not edit them, and do not implement backend code or endpoints.
- If a spec and the backend code disagree, the code wins for wire contracts. Record the conflict in `.claude/knowledge/discrepancies.md`.
- Mockup HTML (`docs/requirements/**/*.html`) is about 90k tokens raw: use `python .claude/scripts/mock_html.py <alias> [text|markup|css]`.
- Test-case tables: `python .claude/scripts/test_cases.py <f1|f2|f3|f5|TC_ID>`.
- Prefer the distilled `.claude/knowledge/*.md`. Open the original docs only for detail they lack, and read just the needed section (Grep for the heading, then Read with offset/limit).
