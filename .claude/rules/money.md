---
paths:
  - "frontend/src/app/**/*.{ts,html}"
---

# Money and percentage rules (hard)

- The backend computes every budget, spent, remaining, and percentage value. Angular only displays them.
- Money stays a `string` end to end. Request values match `^\d+$` and are > 0. Response `remainingVnd` matches `^-?\d+$`.
- Forbidden on money: `Number()`, `parseInt`, `parseFloat`, unary `+`, `*`, `/`, `toFixed`, sums. Display formatting may use `BigInt(v).toLocaleString('en-US') + ' VND'` or a regex grouper.
- Formatting changes display only. Never send a formatted value. Normalize input by removing `,` grouping, then validate `^\d+$`. Reject other characters instead of stripping them.
- `percentageUsed` (number): display at most 2 decimals plus `%`, never clamped. Bar width `Math.min(p, 100)` is a visual transform only.
- Negative remaining and >100% usage are valid states. Show them with text ("Over budget"), not only with color.
- Never hardcode jar names, rates, or budgets. A `jarType`-to-color-token map is the only allowed jar constant.
