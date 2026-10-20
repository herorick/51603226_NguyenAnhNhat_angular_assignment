---
paths:
  - "frontend/src/**/*.{scss,css}"
---

# Style rules

- Reuse tokens (`--f1-*`, `--spacing-*`, `--radius-*`, `styles/theme/_default.scss`) and the global primitives in `src/styles/components/`. No raw hex colors when a token exists.
- **Component styles are capped at 19 kB (production build error).** Copy only the mockup rules a component needs (`mock_html.py <alias> css --grep <class>`). Shared layout goes in global partials.
- Mobile first. Breakpoints: `styles/base/_breakpoint.scss`. Long jar names and VND values must wrap, not overflow.
- Keep a visible focus ring (`--nt-focus`). Over-budget styling must be paired with text.
- Details: `.claude/knowledge/ui-mockups.md`.
