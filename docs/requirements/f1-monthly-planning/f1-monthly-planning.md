# F1 - Monthly Planning User Story

## Story Metadata

- **Story ID:** F1-US-01
- **Story name:** Create a monthly income plan
- **Feature:** F1 - Monthly planning
- **Priority:** Must
- **Status:** Draft
- **Primary actor:** Family finance user
- **Source:** `docs/requirements/monthly-income-allocation.md`

## User Story

> As a family finance user, I want to select a month and enter my total monthly income so that the system can create my monthly plan and prepare the seven default jars for budgeting.

## Preconditions

- The user can access the monthly planning screen.
- No monthly plan exists for the selected year and month.

## Assumptions

| ID | Assumption                                                      | Impact if incorrect                                                 |
| -- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| A1 | The month selector identifies a year and month.                 | Duplicate-plan validation and plan lookup rules may need revision.  |
| A2 | Income is entered as a positive VND amount.                     | Currency and validation rules may need revision.                    |
| A3 | The seven jar names and allocation rates are fixed for the MVP. | The default jar definition must be confirmed before implementation. |

## Basic GUI and Behavior Notes

- The monthly planning screen provides:
  - a month selector;
  - a required monthly income input field in VND;
  - a create-plan action.
- The income field accepts a monetary amount and displays a clear validation message when the value is missing, zero, negative, or invalid.
- After successful creation, the user is taken to or shown the current month's jar dashboard.
- The screen does not require advanced styling, custom jar editing, or expense entry as part of this story.

## Main Workflow

1. The user opens the monthly planning screen.
2. The user selects a year and month.
3. The user enters total monthly income in VND.
4. The user submits the form.
5. The system validates the month and income.
6. The system creates one monthly plan with the seven predefined jars and their default rates.
7. The system shows the created month's jar dashboard.

## Acceptance Criteria

### AC1: Display the monthly planning form

```gherkin
Given the user opens the monthly planning screen
When the screen is displayed
Then the user can select a year and month
And the user can enter total monthly income in VND
And the user can submit the form to create a plan
```

### AC2: Create a monthly plan with valid income

```gherkin
Given no plan exists for the selected year and month
And the user has entered a positive income amount
When the user submits the monthly planning form
Then the system creates one plan for the selected year and month
And the plan contains exactly seven predefined jars
And the jar allocation percentages total exactly 100 percent
And the user can see the current month's jar dashboard
```

### AC3: Reject missing or non-positive income

```gherkin
Given the user is completing the monthly planning form
And the income field is empty, zero, negative, or invalid
When the user submits the form
Then the system does not create a monthly plan
And the user sees a validation message explaining that income must be positive
```

### AC4: Prevent duplicate monthly plans

```gherkin
Given a plan already exists for the selected year and month
When the user submits the monthly planning form
Then the system does not create another plan for that month
And the user sees a message explaining that a plan already exists
```

### AC5: Use the predefined default jars

```gherkin
Given the user creates a monthly plan with valid income
When the plan is created
Then the plan contains these seven jars with the specified default rates:
  | Jar | Rate |
  | Living Expenses | 35 percent |
  | Food | 20 percent |
  | Children | 10 percent |
  | Emergency Fund | 10 percent |
  | Savings | 10 percent |
  | Investment | 10 percent |
  | Entertainment & Travel | 5 percent |
```

## Out of Scope

- Editing jar names or allocation percentages.
- Adding, removing, or reordering jars.
- Recording, editing, or deleting expenses.
- Calculating or displaying detailed jar spending and progress; these belong to F2 and F5.
- Advanced visual design, responsive behavior beyond basic usability, or authentication.

## Non-Functional Requirements

- Monetary values use VND.
- The backend is the source of truth for plan creation and monetary calculations.
- The system must preserve the rule that only one monthly plan exists for a given year and month.

## Traceability

| Requirement                        | Source                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------- |
| F1 monthly planning                | `docs/requirements/monthly-income-allocation.md`                      |
| Positive income required           | `docs/requirements/monthly-income-allocation.md`, Acceptance Criteria |
| Exactly seven predefined jars      | `docs/requirements/monthly-income-allocation.md`, Acceptance Criteria |
| Allocation rates total 100 percent | `docs/requirements/monthly-income-allocation.md`, Acceptance Criteria |
| One plan per year and month        | `docs/requirements/monthly-income-allocation.md`, Acceptance Criteria |

## Open Questions

- Should the month selector default to the current month?
- Should an existing monthly plan be opened for review, or should the user be directed to the dashboard without resubmitting?
- Should income formatting use thousand separators while the user types?

## Readiness Check

- **INVEST:** Independent from expense workflows; valuable for starting monthly budgeting; estimable and small enough for the MVP; testable through the acceptance criteria.
- **Definition of Ready:** Role, goal, value, priority, assumptions, basic GUI behavior, acceptance criteria, scope boundaries, NFRs, and traceability are documented.
