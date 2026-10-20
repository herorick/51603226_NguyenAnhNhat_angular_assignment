# Family Finance Domain Knowledge

## Core Concepts

- **Monthly plan:** One income allocation plan identified by year and month.
- **Jar:** A predefined spending category with an allocation percentage and a
	calculated budget.
- **Expense:** A daily spending transaction assigned to exactly one jar.
- **Spent:** The sum of saved expenses assigned to a jar.
- **Remaining:** The jar budget less its spent amount.

## Default Jar Types and Allocation Rates

A monthly plan contains exactly these seven jars and default rates:

| Jar | Default rate | Suggested logic |
|---|---:|---|
| Living Expenses | 35% | Rent, electricity, water, internet, and insurance |
| Food | 20% | Groceries, market shopping, and household supplies |
| Children | 10% | Tuition, books, tutoring, and extracurricular activities |
| Emergency Fund | 10% | Unexpected expenses or the family emergency reserve |
| Savings | 10% | Long-term family savings |
| Investment | 10% | Regular investment contributions |
| Entertainment & Travel | 5% | Dining out, leisure activities, and travel |

The default rates total exactly 100%. Suggested logic is explanatory guidance
for the user; it is not used as a monetary input.

## Business Rules

BR-001: Monthly income must be greater than 0.

BR-002: A monthly plan contains exactly seven predefined jars.

BR-003: Each allocation percentage must be between 0 and 100.

BR-004: The sum of all seven allocation percentages must equal exactly 100%.

BR-005: The backend is the source of truth for all financial calculations.

BR-006: Jar budget = TotalIncome x AllocationPercentage / 100.

BR-007: The sum of all jar budgets must equal TotalIncome.

BR-008: Only one monthly plan is allowed for each Year + Month.

BR-009: Currency is VND and monetary values are stored as whole VND amounts.

BR-010: An expense amount must be greater than 0 and must be assigned to one jar.

BR-011: An expense requires a non-empty description and an expense date.

BR-012: Spent amount = sum of expense amounts assigned to the jar.

BR-013: Remaining amount = JarBudget - SpentAmount.

BR-014: Creating, editing, or deleting an expense recalculates the affected jar.

BR-015: A deleted expense must not contribute to spent or remaining amounts.