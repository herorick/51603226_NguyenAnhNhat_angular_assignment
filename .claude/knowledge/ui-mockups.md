# UI Mockups and Styling

## Never Read the mockup HTML directly

`docs/requirements/**/*.html` are SingleFile saves of a reference Angular app, ~350 KB each
(~90% base64 fonts, about 90k tokens). Use the extractor (raw Read is denied in settings):

```bash
python .claude/scripts/mock_html.py <file> text                # ~1 KB: headings, labels, buttons, copy
python .claude/scripts/mock_html.py <file> markup              # ~3-9 KB: cleaned DOM structure + classes
python .claude/scripts/mock_html.py <file> css --grep jar-card  # only CSS rules mentioning a word
```

Start with `text`. Use `markup` when building the template. Use `css --grep` for specific classes; a full `css` dump is ~20 KB.

## Mockup map

| File (`docs/requirements/`) | Saved URL | Shows |
|---|---|---|
| `f1-monthly-planning/f1-monthly-planning.html` | `/monthly-planning` | F1 form: `<input type=month id=period>`, income text + `VND` suffix, 7 default-jar cards, "100% allocated" |
| `f1-monthly-planning/f1-monthly-planning-unavailble.html` | `/monthly-plans/2026/9` | F2 missing-plan state: "Monthly plan unavailable", "Create a plan" link |
| `f2-income-allocation/f2-income-allocation.html` | `/monthly-plans/2026/11` | F2 "Month Budget Summary": total income, donut "100% allocated", legend, "The Seven Jars" cards |
| `f3-add-expenses/f3-add-expenses.html` | `/expenses/new` | F3 "Add an expense": Expense details form + "Selected jar" side panel |
| `f5-dashboard/f5-dashboard.html` | `/dashboard` | Full dashboard. Only the "Updated spending statistics" per-jar rows are in scope for Spending by Jar |
| `style guideline/design-tokens-preview.html` | - | Token preview (small, safe to extract) |

Spec docs name these files `month-budget-summary.html` and `adding-expenses.html`. Those files do not exist; use the table above.
Mockup values (`123,456,789`, `133 VND`, Recent activity rows) are illustrative only. Bind API data.

## Shared shell seen in every mockup

- `app-family-finance-header`: brand link to `/monthly-planning`, account button "Family Name"/"FN" (static, no auth).
- `app-family-finance-sidebar [activeItem]`: nav links Home `/dashboard`, Planning `/monthly-planning`, Add Expense `/expenses/new`.
- Back link per page: F2 "Back to monthly planning", F3 "Back to expenses".
- Build these once in `src/app/shared/components/`.

## Exact UI copy worth reusing

- F1: "Create your monthly budget", "Plan details", "Select a month for this plan.", "Income must be a positive whole-VND amount.", "Create monthly plan", "Your default allocation", "These rates are fixed for your first monthly plan."
- F2: "Month Budget Summary", "Total monthly income", "Monthly plan for {Month YYYY}", "The Seven Jars", "Your income is allocated to 7 jars based on the default rates."
- F2 missing: "Monthly plan unavailable", "There is no monthly plan for this period yet.", "Create a plan".
- F3: "Add an expense", "Expense details", "Please select a jar.", "Enter a positive whole-VND amount.", "Amount must be greater than zero.", "Description is required.", "Save expense", "Selected jar", "Jar spending totals refresh after the expense is saved."
- F5 rows: `{jarName}  {pct}%  {spent} / {planned} VND`.
- Jar option label: `{name} · {percentage}%`.

## Styling rules

- Global styles: `frontend/src/styles/_app.scss` (configured in angular.json). Tokens live in `styles/base/*` (`--f1-*`, `--spacing-*`, `--radius-*`) and `styles/theme/_default.scss`. Reuse them and the component primitives (`components/_cards|_buttons|_forms|...`).
- **Component style budget: 19 kB hard error in production build.** Never paste a whole mockup CSS (~20 KB) into one component; take only the rules that component needs and prefer the global primitives.
- Jar colors: map `jarType` to `--f1-jar-*` tokens (see `domain-rules.md`).
- Font: Mulish from `public/assets/fonts`, already wired in `styles/fonts`.
