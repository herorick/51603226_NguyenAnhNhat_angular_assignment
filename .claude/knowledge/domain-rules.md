# Domain Rules (frontend view)

Full source: `docs/knowledge/domain.md` (BR-001..BR-015).

## Seven jars, canonical order (backend `DefaultJarCatalog`)

| # | `jarType` | Name | Rate | Color token (presentation only) |
|---|---|---|---:|---|
| 1 | `livingExpenses` | Living Expenses | 35 | `--f1-jar-living` |
| 2 | `food` | Food | 20 | `--f1-jar-food` |
| 3 | `children` | Children | 10 | `--f1-jar-children` |
| 4 | `emergencyFund` | Emergency Fund | 10 | `--f1-jar-emergency` |
| 5 | `savings` | Savings | 10 | `--f1-jar-savings` |
| 6 | `investment` | Investment | 10 | `--f1-jar-investment` |
| 7 | `entertainmentAndTravel` | Entertainment & Travel | 5 | `--f1-jar-travel` |

Names, rates, and order come from the API at runtime. A `jarType`-to-color map is the only jar
constant the frontend may own. Do not hardcode names, rates, or budgets.

## Rules the frontend must respect

- One plan per year+month (BR-008). Duplicate create returns 409; show the message, offer a link to the existing plan, and never replace the plan.
- Income and expense amounts are positive whole VND (BR-001, BR-009, BR-010). Reject empty, 0, negative, decimal, grouped-on-the-wire, and non-digit input.
- Expense needs a date, one jar from that date's month plan, and a trimmed non-empty description of at most 500 chars (BR-010, BR-011).
- Backend owns every number: budget (BR-006/007, largest-remainder rounding), spent (BR-012), remaining (BR-013), percentageUsed.
- Overspending is allowed: `remainingVnd` can be negative and `percentageUsed` can be > 100. Show these, never block or clamp the text.
- Expense edit/delete (F4) and the full F5 dashboard (totals, recent activity) are out of scope. Only the read-only Spending by Jar view is in scope.

## Money handling in Angular

- Wire money = digit strings (`"25000000"`). Only `remainingVnd` may carry a leading `-`.
- Never `Number()`/`parseFloat`/`+x` money for arithmetic. There is no client arithmetic to do.
- Display formatting only: group digits on the string (regex), or `BigInt(value).toLocaleString('en-US')`, then append ` VND`. Mockups show `25,000,000 VND`.
- Form input may show grouping; normalize to ungrouped ASCII digits before validation and the request. Do not silently strip arbitrary characters (reject `abc`, `1.5`, `-1`).
- `percentageUsed` is a number: display with at most 2 decimals plus `%`. The progress bar width is `min(percentageUsed, 100)` as a visual transform only.
