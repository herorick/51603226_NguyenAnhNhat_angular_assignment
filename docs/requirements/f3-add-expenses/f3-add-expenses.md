# F3 - Add and Assign an Expense User Story

## Story Metadata

- **Story ID:** F3-US-01
- **Story name:** Add an expense to a jar in a monthly plan
- **Feature:** F3 - Add and assign an expense
- **Priority:** Must
- **Status:** Draft
- **Primary actor:** Family finance user
- **Source:** `docs/requirements/product-brief.md`, `docs/knowledge/domain.md`
- **Dependency:** F1 - Monthly planning; F2 - Allocate income to seven jars

## User Story

> As a family finance user, I want to record an expense and assign it to a jar in a selected monthly plan so that I can track spending against the correct part of my monthly budget.

## Preconditions

- A monthly plan exists for the month in which the user wants to record an expense.
- The plan contains its seven predefined jars.

## Assumptions

| ID | Assumption | Impact if incorrect |
| -- | ---------- | ------------------ |
| A1 | An expense is created within the context of one existing monthly plan, and the user selects exactly one jar belonging to that plan. | The month/jar selection workflow and expense-to-plan association need revision. |
| A2 | The expense date must fall within the calendar month of the selected monthly plan. | Date validation and plan association rules need revision. |
| A3 | Expense amounts are entered in whole VND and must be greater than zero. | Amount validation and storage precision need revision. |
| A4 | Saving an expense updates the selected jar's spent and remaining totals using backend calculations. | If totals are deferred or calculated differently, the post-save behavior needs revision. |

## Basic GUI and Behavior Notes

- The expense-entry workflow lets the user select or confirm a monthly plan, select one jar from that plan, enter an amount in VND, enter a description, enter an expense date within that plan's calendar month, and save the expense.
- If no plan exists for the requested month, the system does not offer jars from another month as a substitute; it informs the user that a monthly plan is required.
- After a successful save, the user receives confirmation and can see the expense reflected in the selected jar's spending totals.
- **Mockup/wireframe:** TBD.

## Main Workflow

1. The user opens expense entry for a month with an existing plan.
2. The user selects one jar from that month's plan.
3. The user enters a positive whole-VND amount, a non-empty description, and an expense date.
4. The user saves the expense.
5. The system validates the required fields, jar membership, and that the expense date falls within the selected plan month.
6. The system saves the expense against the selected plan and jar.
7. The system recalculates the selected jar's spent and remaining totals and confirms the saved expense.

## Acceptance Criteria

### AC1: Select a jar from the requested month's plan

```gherkin
Given a monthly plan exists for the selected month
When the user starts adding an expense
Then the user can select one of the jars belonging to that monthly plan
And the selected expense is associated with that month and jar
```

### AC2: Save a valid expense and update the selected jar totals

```gherkin
Given a monthly plan exists for the selected month
And the user has selected a jar in that plan
And the user has entered a positive whole-VND amount, a non-empty description, and an expense date within that plan month
When the user saves the expense
Then the expense is saved with the entered amount, description, date, month, and jar
And the selected jar's spent amount includes the saved expense
And the selected jar's remaining amount is recalculated by the backend
And the user receives confirmation that the expense was saved
```

### AC3: Reject an expense without a positive amount

```gherkin
Given the user is entering an expense
And the amount is empty, zero, negative, or invalid
When the user saves the expense
Then the expense is not saved
And the user sees a validation message that the amount must be greater than zero
And the jar totals remain unchanged
```

### AC4: Reject an expense without a jar, description, or date

```gherkin
Given the user is entering an expense for a monthly plan
And the jar, description, or expense date is missing
When the user saves the expense
Then the expense is not saved
And the user is told which required information is missing
And the jar totals remain unchanged
```

### AC5: Do not allow a jar from another month or an unavailable plan

```gherkin
Given no monthly plan exists for the selected month
Or the selected jar does not belong to the selected month's plan
When the user attempts to save an expense
Then the expense is not saved
And no other month's jar is substituted
And the user is informed that a valid monthly plan and jar selection are required
```

### AC6: Reject an expense date outside the selected plan month

```gherkin
Given a monthly plan exists for the selected month
And the user has selected a jar in that plan
And the expense date is before or after the selected plan month
When the user saves the expense
Then the expense is not saved
And the user sees a validation message that the expense date must be within the selected month
And the jar totals remain unchanged
```

## Out of Scope

- Creating a monthly plan or modifying its income; covered by F1.
- Changing jar names, allocation percentages, or budgets.
- Editing or deleting an existing expense; covered by F4.
- Adding recurring expenses, split expenses across multiple jars, attachments, or expense categories beyond the selected jar.
- Defining an overdraft/overspending restriction; the source requirements do not prohibit expenses from exceeding the jar budget.
- Detailed dashboard layout and progress visualization; covered by F5.

## Non-Functional Requirements

- Currency is VND and monetary values are stored as whole VND amounts.
- The backend is the source of truth for spent and remaining monetary calculations.
- No response-time, availability, or authentication requirements are specified for this story.

## Traceability

| Requirement | Source |
| ---------- | ------ |
| F3 - Record a daily expense and assign it to a jar | `docs/requirements/product-brief.md`, Feature Catalog |
| Expense amount must be positive and assigned to one jar | `docs/requirements/product-brief.md`, Acceptance Criteria; `docs/knowledge/domain.md`, BR-010 |
| Expense requires a non-empty description and date | `docs/knowledge/domain.md`, BR-011 |
| Expense is assigned to exactly one jar in the monthly plan | `docs/knowledge/domain.md`, Core Concepts; `docs/requirements/product-brief.md`, F3 Basic logic |
| Expense date must fall within the selected monthly plan month | Confirmed by the user for this story |
| Saving an expense updates jar totals using backend calculations | `docs/requirements/product-brief.md`, Acceptance Criteria; `docs/knowledge/domain.md`, BR-005, BR-012, BR-013, and BR-014 |
| Monetary values use whole VND | `docs/knowledge/domain.md`, BR-009 |
| F1 provides the monthly plan and F2 provides its allocated jar budgets | `docs/requirements/product-brief.md`, Feature Catalog |

## Open Questions

- **Business/finance:** Are expenses allowed to exceed the selected jar's remaining balance? The source requirements do not define a spending cap or warning.
- **UX:** Should expense entry begin from a jar on the dashboard (preselecting month and jar), or from a general expense form where the user selects both?
- **Data:** Are empty descriptions rejected after trimming whitespace, and is there a maximum description length?
- **Business:** Should the user be able to save more than one expense in a single action, or is this story limited to one expense per save?

## Readiness Check

- **INVEST:** Independent after F1 creates a monthly plan and F2 exposes the jars; valuable for tracking actual spending; estimable as a single add-expense workflow; small enough for the MVP; testable through the acceptance criteria.
- **Definition of Ready:** Role, goal, value, priority, assumptions, preconditions, workflow, acceptance criteria, scope boundaries, NFRs, and traceability are documented. **Draft pending decisions** on overspending behavior and entry point.