# Family Finance Management - MVP Feature List

## Scope

The system helps a family plan one month's income across seven predefined jars,
review jar performance, and record daily spending against a jar.

Currency: VND.

## Default Jar Allocation

The system creates the following seven jars for every new monthly plan:

| Jar                    | Default rate | Suggested logic                                          |
| ---------------------- | -----------: | -------------------------------------------------------- |
| Living Expenses        |          35% | Rent, electricity, water, internet, and insurance        |
| Food                   |          20% | Groceries, market shopping, and household supplies       |
| Children               |          10% | Tuition, books, tutoring, and extracurricular activities |
| Emergency Fund         |          10% | Unexpected expenses or the family emergency reserve      |
| Savings                |          10% | Long-term family savings                                 |
| Investment             |          10% | Regular investment contributions                         |
| Entertainment & Travel |           5% | Dining out, leisure activities, and travel               |

The default rates total 100%. The suggested logic is displayed as guidance and
does not replace the calculated jar budget.

## Feature Catalog

| ID | Feature                       | Description                                                                                                   | Basic logic                                                                                      | Priority |
| -- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| F1 | Monthly planning              | The user starts a new month and enters the total monthly income.                                              | Select month -> enter income -> the system creates the seven default jars and rates shown above. | Must     |
| F2 | Allocate income to seven jars | The system displays the amount allocated to each jar.                                                         | Jar budget = total income x default jar rate / 100.                                              | Must     |
| F3 | Add and assign an expense     | The user can record a daily expense and assign it to a jar.                                                   | Enter amount -> choose jar -> enter description -> save transaction.                             | Must     |
| F4 | Edit or delete an expense     | The user can correct or remove an existing expense.                                                           | On edit or delete, recalculate the affected jar's spent and remaining amounts.                   | Must     |
| F5 | Jar management / dashboard    | The user can view income, total spending, remaining balance, progress, and an identifying color for each jar. | Each jar has an ID, name, allocation percentage, budget, spent amount, and remaining amount.     | Must     |

## Acceptance Criteria

- A monthly plan cannot be created without a positive income amount.
- Each monthly plan contains exactly seven predefined jars.
- The seven allocation percentages total exactly 100%.
- The backend calculates all allocation, spent, and remaining monetary amounts.
- The user can see the current month's jar dashboard after creating a plan.
- An expense must have a positive amount, a jar, and a description before it can be saved.
- Saving, editing, or deleting an expense updates the relevant jar totals.
- Only one monthly plan exists for a given year and month.
