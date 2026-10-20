# F5 - Monthly Dashboard User Story

## Story Metadata

- **Story ID:** F5-US-01
- **Story name:** Review a monthly plan and its jar performance
- **Feature:** F5 - Jar management / dashboard
- **Priority:** Must
- **Status:** Draft
- **Primary actor:** Family finance user
- **Source:** `docs/requirements/monthly-income-allocation.md`, Feature Catalog; user request
- **Dependencies:** F1 - Monthly planning; F2 - Allocate income to seven jars; F3 - Add and assign an expense; F4 - Edit or delete an expense

## User Story

> As a family finance user, I want to select a monthly plan and review its overall and per-jar budget performance so that I can understand my spending and budget status.

## Preconditions

- The user can access the dashboard.
- At least one monthly plan exists to display plan metrics.
- Saved expenses are associated with a jar in a monthly plan.

## Assumptions

| ID | Assumption | Impact if incorrect |
| -- | ---------- | ------------------ |
| A1 | The month selector lists months for which a plan exists and identifies each plan by year and month. | The selector's available values and no-plan navigation need revision. |
| A2 | Overall progress means total spent divided by monthly income; each jar's progress means jar spent divided by jar budget. | Progress values and the dashboard's meaning need revision. |
| A3 | Remaining balance is monthly income less total spent overall, and jar budget less jar spent for each jar. | Displayed balance definitions need revision. |
| A4 | When saved expenses exceed a budget, the dashboard shows a negative remaining balance and progress above 100%; it does not block or alter the expense. | Over-budget display and F3 spending rules need revision. |

## Main Workflow

1. The user opens the dashboard.
2. The user selects a month for which a monthly plan exists.
3. The system displays that plan's total income, total spent, remaining balance, and overall progress.
4. The system displays each of the plan's seven jars with its allocation rate, allocated budget, spent amount, remaining balance, progress, and identifying color.
**Alternate flow:** None identified for this dashboard view.

**Mockup/wireframe:** TBD. `docs/requirements/f2-income-allocation/month-budget-summary.html` is a related allocation-view prototype; it does not specify F5 spent/balance values.

## Acceptance Criteria

### AC1: Select a monthly plan

```gherkin
Given one or more monthly plans exist
When the user opens the dashboard
Then the user can select a plan by year and month
And the dashboard identifies which plan is currently selected
```

### AC2: Display the selected plan's overall performance

```gherkin
Given a monthly plan exists for the selected year and month
When the user views the dashboard
Then the dashboard displays that plan's total monthly income, total spent, remaining balance, and progress
And total spent equals the sum of saved expenses assigned to the plan's jars
And remaining balance equals total monthly income less total spent
And progress represents total spent as a percentage of total monthly income
```

### AC3: Display allocation and performance for every jar

```gherkin
Given a monthly plan exists for the selected year and month
When the user views the dashboard
Then the dashboard displays exactly the seven jars belonging to that plan
And each jar shows its name, identifying color, allocation rate, allocated budget, spent amount, remaining balance, and progress
And each jar's remaining balance equals its allocated budget less its spent amount
And each jar's progress represents its spent amount as a percentage of its allocated budget
```

### AC4: Show zero-spending values for a plan without expenses

```gherkin
Given a monthly plan exists and has no saved expenses
When the user views the dashboard
Then total spent is shown as zero VND and overall remaining balance equals total monthly income
And every jar's spent amount is shown as zero VND and its remaining balance equals its allocated budget
And overall and per-jar progress are shown as zero percent
```

### AC5: Reflect saved expense changes

```gherkin
Given the selected monthly plan has a saved expense created, edited, or deleted through the applicable expense flow
When the user views or refreshes the dashboard
Then the affected jar's spent amount, remaining balance, and progress reflect the saved expense state
And the plan's total spent, remaining balance, and progress reflect the saved expense state
```

### AC6: Use authoritative monetary values

```gherkin
Given the user views a monthly plan on the dashboard
When the system displays income, allocated budgets, spent amounts, or remaining balances
Then monetary values are displayed in whole VND using backend-calculated values
And the dashboard does not substitute independently calculated monetary values
```

## Out of Scope

- Creating a monthly plan or changing its income; covered by F1.
- Changing jar names, allocation rates, adding jars, or removing jars.
- Creating, editing, or deleting expenses; covered by F3 and F4.
- Setting spending limits, rejecting overspending, or warning about overspending; the source requirements do not define this policy.
- Detailed visual styling, chart type, responsive breakpoints, or a final dashboard mockup.

## Non-Functional Requirements

- Currency is VND and monetary values are displayed as whole VND amounts.
- The backend is the source of truth for all monetary calculations.
- No response-time, availability, authentication, or browser-support thresholds are specified in the available source requirements.

## Traceability

| Requirement | Source |
| ---------- | ------ |
| F5 dashboard shows income, total spending, remaining balance, progress, and identifying jar colors | `docs/requirements/monthly-income-allocation.md`, Feature Catalog |
| Each jar has an ID, name, allocation percentage, budget, spent amount, and remaining amount | `docs/requirements/monthly-income-allocation.md`, Feature Catalog |
| Backend owns financial calculations; currency is VND | `docs/requirements/monthly-income-allocation.md`, Acceptance Criteria; `docs/knowledge/domain.md`, BR-005 and BR-009 |
| Spent and remaining amounts are derived from assigned expenses and jar budgets | `docs/knowledge/domain.md`, BR-012 and BR-013 |
| Expense create/edit/delete recalculates affected jar totals | `docs/knowledge/domain.md`, BR-014 and BR-015 |
| One monthly plan exists per year and month | `docs/requirements/monthly-income-allocation.md`, Acceptance Criteria; `docs/knowledge/domain.md`, BR-008 |
| Dashboard is shown after creating a monthly plan | `docs/requirements/f1-monthly-planning/f1-monthly-planning.md`, AC2 |
| F2 defers spent, remaining, and progress display to F5 | `docs/requirements/f2-income-allocation/f2-income-allocation.md`, Out of Scope |

**Source gap:** The request referenced `product-brief.md`, but that file was not present in the workspace. `docs/requirements/monthly-income-allocation.md` was used as the available feature source; confirm whether the missing brief contains additional F5 requirements.

## Open Questions

- **Business:** Confirm the definitions of overall and per-jar progress in A2, including display precision and whether progress may exceed 100%.
- **Business/finance:** Confirm whether over-budget expenses are allowed and whether negative remaining balances should be shown; F3 currently leaves the spending cap unresolved.
- **UX:** Should the dashboard initially select the current month, the most recent plan, or require explicit selection?
- **Requirements:** Provide or confirm the intended `product-brief.md` source and whether it adds further F5 behavior.

## Readiness Check

- **INVEST:** Delivers a complete monthly review capability using existing F1-F4 data; independently demonstrable after a plan exists; testable through observable dashboard values.
- **Definition of Ready:** Actor, goal, value, priority, dependencies, assumptions, workflow, acceptance criteria, scope, NFRs, and traceability are documented. **Draft pending confirmation** of progress semantics, overspending presentation, month-selection default, and source brief.