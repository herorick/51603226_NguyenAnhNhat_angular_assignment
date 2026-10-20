---
paths:
  - "frontend/src/app/**/*.{ts,html}"
---

# Angular 21 frontend rules

- Standalone by default: do not write `standalone: true`. Use `inject()`, `ChangeDetectionStrategy.OnPush`, and `input()`/`output()`.
- **Zoneless app (no zone.js).** Keep view state in `signal`/`computed`. Bridge observables with `toSignal` or subscribe with `takeUntilDestroyed()`. Plain field mutation from async callbacks does not refresh the view.
- Templates use `@if`/`@for (...; track item.jarType)`/`@switch`. No `*ngIf`/`*ngFor`.
- Typed Reactive Forms (`NonNullableFormBuilder`). The template-driven `ngModel` is not used.
- Layers: page components handle routing, forms, loading, and UI states. Presentation components only use inputs/outputs (no `HttpClient`, no services). `core/services` own HTTP. `models/` hold DTO interfaces.
- Layout and naming: see `.claude/knowledge/discrepancies.md` #11 (`features/<area>/pages/<page>/<page>.component.ts`). Generate from `frontend/` (a standalone `cd frontend` first, because `npm exec` from the root breaks paths): `npx ng g c features/<area>/pages/<page> --type=component --style=scss` and `npx ng g s core/services/<name> --type=service`. Both were verified to produce `*.component.ts` and `*.service.ts`.
- Request-state pattern per page: `status = signal<'loading' | 'ready' | 'not-found' | 'error'>('loading')`. Retry re-runs the same loader.
- Submit pattern: `if (this.form.invalid || this.submitting()) { markAllAsTouched; focus first invalid; return; }`, then `submitting.set(true)` and `finalize(() => submitting.set(false))`.
- Accessibility: every control has `<label for>`. Errors have an `id` and are linked with `aria-describedby`. Set `[attr.aria-invalid]`. Loading and success messages use `aria-live="polite"`, errors use `role="alert"`. Buttons need an explicit `type`. Never signal state by color alone.
- Type safety: no `any`, no `as` casts on HTTP responses, no `!` on API data.
- Money and percentages: see `.claude/rules/money.md`. API details: `.claude/knowledge/api-contract.md`.
- Prettier: 120 cols, single quotes, semicolons, no trailing commas.
