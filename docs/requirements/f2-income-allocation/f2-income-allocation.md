# F2 - Allocate Income to Seven Jars User Story

## Story Metadata

- **Story ID:** F2-US-01
- **Story name:** View monthly income allocated across seven jars
- **Feature:** F2 - Allocate income to seven jars
- **Priority:** Must
- **Status:** Draft
- **Primary actor:** Family finance user
- **Source:** `docs/requirements/monthly-income-allocation.md`, `docs/knowledge/domain.md`
- **Dependency:** F1 - Monthly planning

## User Story

> As a family finance user, I want to see how my monthly income is allocated across the seven jars so that I can understand the budget available for each category.

## Preconditions

- A monthly plan exists for the month the user wants to view.
- The plan has a positive monthly income and the seven predefined allocation rates.

## Assumptions

| ID | Assumption                                                                            | Impact if incorrect                                                                   |
| -- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A1 | F2 displays the selected month's existing plan; it does not create or change a plan.  | Plan creation and editing behavior would need to be included or separately specified. |
| A2 | If no plan exists for the requested month, the user is told to create one through F1. | The no-plan workflow and navigation may need to change.                               |
| A3 | Jar amounts are calculated by the backend and presented in whole VND.                 | The calculation ownership or currency precision contract would need revision.         |

## Main Workflow

1. The user opens an existing monthly plan.
2. The system obtains the monthly income and the seven predefined jar allocation rates.
3. The backend calculates each jar budget using `monthly income x allocation percentage / 100` and applies the approved whole-VND precision policy.
4. The user sees the seven jar names, rates, and calculated budget amounts in VND.

**Mockup/wireframe:** TBD. The F1 story notes that detailed jar amounts belong to F2, but no F2-specific visual specification is available.

## Acceptance Criteria

### AC1: Display the seven allocated jar budgets

```gherkin
Given a monthly plan exists with a positive income
And the plan has the seven predefined jar rates
When the user views the plan
Then the system displays one budget amount in VND for each of the seven jars
And each displayed amount is calculated as monthly income multiplied by the jar rate and divided by 100
And the system displays the jar's allocation rate with its amount
```

### AC2: Calculate a plan with whole-VND results

```gherkin
Given the monthly income is a
And the plan uses the predefined rates
When the user views the plan
Then each jar shows a*predefined rate VND
```

### AC3: Do not show calculated amounts without a monthly plan

```gherkin
Given no monthly plan exists for the requested month
When the user tries to view that month's jar allocation
Then the system does not display fabricated jar amounts
And the user is informed that a monthly plan must be created first
```

### AC4: Use backend-calculated amounts

```gherkin
Given a monthly plan exists
When the system presents the jar budgets
Then the displayed amounts are the amounts calculated by the backend
And the frontend does not substitute independently calculated amounts
```

## Out of Scope

- Creating a monthly plan or changing monthly income; covered by F1.
- Editing jar names, adding or removing jars, or changing allocation rates.
- Recording, editing, or deleting expenses; covered by F3 and F4.
- Displaying spent amounts, remaining balances, or progress; covered by F5.

## Non-Functional Requirements

- Currency is VND and monetary amounts are whole VND values.
- The backend is the source of truth for financial calculations.
- No response-time or availability threshold is specified in the source requirements.

## Traceability

| Requirement                                                    | Source                                                                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| F2 - Display the amount allocated to each jar                  | `docs/requirements/monthly-income-allocation.md`, Feature Catalog                                                                                 |
| Budget formula: total income x default rate / 100              | `docs/requirements/monthly-income-allocation.md`, Feature Catalog; `docs/knowledge/domain.md`, BR-006                                           |
| Seven predefined jars and rates total 100%                     | `docs/requirements/monthly-income-allocation.md`, Default Jar Allocation and Acceptance Criteria; `docs/knowledge/domain.md`, BR-002 and BR-004 |
| Backend calculates monetary amounts; currency is VND           | `docs/requirements/monthly-income-allocation.md`, Acceptance Criteria; `docs/knowledge/domain.md`, BR-005 and BR-009                            |
| Total jar budgets equal monthly income                         | `docs/knowledge/domain.md`, BR-007                                                                                                                |
| F1 creates the monthly plan; detailed allocations belong to F2 | `docs/requirements/f1-monthly-planning/f1-monthly-planning.md`, Out of Scope                                                                      |

## Open Questions

- **Business/finance:** What rounding mode and remainder-allocation rule should be used when the formula produces fractional VND amounts? This affects BR-007, which requires whole-VND jar budgets to sum exactly to income.
- **Requirements consistency:** Should the architecture be updated to match the seven jars in the current feature requirement and domain rules? `docs/design/architecture.md` currently describes a different five-jar model.
- **UX:** Where should the user land after opening a plan, and should the F2 allocation view have a dedicated wireframe?

## Readiness Check

- **INVEST:** Independent after F1 creates a plan; valuable for understanding category budgets; estimable once financial precision is settled; small and demonstrable; acceptance criteria are testable for whole-VND results.
- **Definition of Ready:** Drafted with role, value, priority, dependency, assumptions, scope, acceptance criteria, NFRs, and traceability. **Not ready for implementation contract freeze** until the architecture mismatch and rounding/remainder policy are resolved.
