# F1 + F2 Monthly Planning and Income Allocation - Backend Development Specification

## 1. Feature Overview

This document is the shared backend contract for:

- **F1 - Monthly planning:** create one monthly plan from a selected year, month, and positive whole-VND income.
- **F2 - Income allocation:** read the existing plan and display the seven backend-calculated jar budgets.

F1 owns creation. F2 is read-only and consumes the same monthly-plan response created by F1. The backend is authoritative for jar definitions, rates, calculations, persistence, and financial invariants.

Out of scope: editing plans or rates, expenses, spent/remaining values, progress, authentication, and dashboard aggregation.

**Status:** Draft. Contract freeze requires approval of the whole-VND rounding/remainder policy and the source requirements.

## 2. Source Alignment and Shared Decisions

This specification follows the F1/F2 requirements, `docs/knowledge/domain.md`, and [architecture.md](architecture.md). The application has exactly seven fixed jars:

| `jarType` | Display name | Percentage |
|---|---|---:|
| `livingExpenses` | Living Expenses | 35 |
| `food` | Food | 20 |
| `children` | Children | 10 |
| `emergencyFund` | Emergency Fund | 10 |
| `savings` | Savings | 10 |
| `investment` | Investment | 10 |
| `entertainmentAndTravel` | Entertainment & Travel | 5 |

The rates total exactly 100%. Money is whole VND. JSON money properties are digit-only strings; years, months, and percentages are JSON integers.

The API contract is shared as follows:

- `GET /default-jars` supplies the F1 planning form.
- `POST /budget-plans` creates the F1 plan and seven allocations.
- `GET /budget-plans/{year}/{month}` is the single read API used by F1 after creation and by F2 for the allocation view.
- F2 must not introduce a separate `/allocation` endpoint or a second calculation contract.

The visual reference [month-budget-summary.html](../requirements/f2-income-allocation/month-budget-summary.html) is mockup-only. Its sample values are not API fixtures or persistence requirements. Its donut, colors, icons, and percentage-share meters do not add backend fields; the meters represent allocation percentages, not spending progress.

## 3. Business Rules and Invariants

| ID | Rule | Enforcement |
|---|---|---|
| F1-AC1 / BR-001 | A plan requires a selected year/month and positive income. | Validate before persistence. |
| F1-AC2 / F1-AC5 / BR-002 | Every plan has exactly the seven canonical jars. | Create from one backend-owned definition; ignore caller jar data. |
| F1-AC2 / BR-004 | Rates are fixed and total 100%. | Validate the canonical definition and persisted aggregate. |
| BR-005 / BR-006 | Backend calculates every budget as income x percentage / 100. | Never trust client-calculated amounts. |
| F1-AC4 | One plan exists per year/month. | Application check plus unique database index. |
| F2-AC1 / F2-AC4 | Existing plans return seven names, rates, and backend budgets. | Validate before mapping the response. |
| BR-007 / BR-009 | Budget amounts are whole VND and sum exactly to income. | Apply the approved deterministic policy and verify before save/read. |
| F2-AC3 | Missing plans do not produce fabricated amounts. | Return `404 MONTHLY_PLAN_NOT_FOUND`. |

## 4. Domain Model

```text
BudgetPlan
  Id: int
  Year: int
  Month: int
  MonthlyIncomeVnd: long
  CreatedAtUtc: DateTime
  Allocations: exactly seven BudgetAllocation records

BudgetAllocation
  Id: int
  BudgetPlanId: int
  JarType: JarType enum
  PercentagePoints: int
  BudgetVnd: long
```

The canonical jar definition is an application constant/value list, not a persisted catalog. Keep its order stable for calculation tie-breaking and API response ordering.

## 5. Database Design

Reuse `BudgetPlans` and `BudgetAllocations`. F2 adds no tables or migrations.

### `BudgetPlans`

| Column | SQLite type | Null | Constraint |
|---|---|---|---|
| `Id` | `INTEGER` | No | Primary key, autoincrement |
| `Year` | `INTEGER` | No | `CHECK (Year BETWEEN 1 AND 9999)` |
| `Month` | `INTEGER` | No | `CHECK (Month BETWEEN 1 AND 12)` |
| `MonthlyIncomeVnd` | `INTEGER` | No | `CHECK (MonthlyIncomeVnd > 0)` |
| `CreatedAtUtc` | `TEXT` | No | Backend-generated UTC ISO-8601 timestamp |

Add a unique index on `(Year, Month)`.

### `BudgetAllocations`

| Column | SQLite type | Null | Constraint |
|---|---|---|---|
| `Id` | `INTEGER` | No | Primary key, autoincrement |
| `BudgetPlanId` | `INTEGER` | No | Required FK to `BudgetPlans`, cascade delete |
| `JarType` | `TEXT` | No | One of the seven canonical values |
| `PercentagePoints` | `INTEGER` | No | `CHECK (PercentagePoints BETWEEN 0 AND 100)` |
| `BudgetVnd` | `INTEGER` | No | `CHECK (BudgetVnd >= 0)` |

Add unique `(BudgetPlanId, JarType)`. Exactly-seven and cross-row sum invariants are enforced in application operations.

Use C# `long` for amounts, `int` for year/month/percentage, and an enum converted to stable text values. The existing decimal schema requires an EF migration; do not delete or reset the database. Convert legacy data only when exact conversion is possible and the approved migration decision permits it.

## 6. Shared API Contract

Base path: `/api/v1/budget-plans`. JSON names are camelCase.

### API-F1F2-01 - Get default jars

`GET /api/v1/budget-plans/default-jars`

No parameters or body. Returns `200 OK`:

```json
{
  "currency": "VND",
  "totalPercentage": 100,
  "jars": [
    { "jarType": "livingExpenses", "name": "Living Expenses", "percentage": 35, "suggestedLogic": "Rent, electricity, water, internet, and insurance" },
    { "jarType": "food", "name": "Food", "percentage": 20, "suggestedLogic": "Groceries, market shopping, and household supplies" },
    { "jarType": "children", "name": "Children", "percentage": 10, "suggestedLogic": "Tuition, books, tutoring, and extracurricular activities" },
    { "jarType": "emergencyFund", "name": "Emergency Fund", "percentage": 10, "suggestedLogic": "Unexpected expenses or the family emergency reserve" },
    { "jarType": "savings", "name": "Savings", "percentage": 10, "suggestedLogic": "Long-term family savings" },
    { "jarType": "investment", "name": "Investment", "percentage": 10, "suggestedLogic": "Regular investment contributions" },
    { "jarType": "entertainmentAndTravel", "name": "Entertainment & Travel", "percentage": 5, "suggestedLogic": "Dining out, leisure activities, and travel" }
  ]
}
```

### API-F1F2-02 - Create monthly plan

`POST /api/v1/budget-plans`

Request body:

```json
{ "year": 2026, "month": 9, "monthlyIncomeVnd": "30000000" }
```

`year` is 1-9999; `month` is 1-12; `monthlyIncomeVnd` is required ASCII digits, parseable as positive signed 64-bit integer. Do not accept `jarType`, `percentage`, or `budgetVnd` from the client.

Success is `201 Created` with `BudgetPlanResponse` and `Location: /api/v1/budget-plans/{year}/{month}`. No rows are committed on failure.

### API-F1F2-03 - Get monthly plan and allocation

`GET /api/v1/budget-plans/{year:int}/{month:int}`

This is the shared read endpoint for F1's post-create view and F2's allocation page. It has no query parameters or body. Valid path values return `200 OK` with `BudgetPlanResponse`; a valid period with no plan returns `404 MONTHLY_PLAN_NOT_FOUND`.

Example success response:

```json
{
  "id": 17,
  "year": 2026,
  "month": 9,
  "monthlyIncomeVnd": "30000000",
  "currency": "VND",
  "createdAtUtc": "2026-09-26T10:30:00Z",
  "jars": [
    { "jarType": "livingExpenses", "name": "Living Expenses", "percentage": 35, "budgetVnd": "10500000" },
    { "jarType": "food", "name": "Food", "percentage": 20, "budgetVnd": "6000000" },
    { "jarType": "children", "name": "Children", "percentage": 10, "budgetVnd": "3000000" },
    { "jarType": "emergencyFund", "name": "Emergency Fund", "percentage": 10, "budgetVnd": "3000000" },
    { "jarType": "savings", "name": "Savings", "percentage": 10, "budgetVnd": "3000000" },
    { "jarType": "investment", "name": "Investment", "percentage": 10, "budgetVnd": "3000000" },
    { "jarType": "entertainmentAndTravel", "name": "Entertainment & Travel", "percentage": 5, "budgetVnd": "1500000" }
  ]
}
```

The response contains no `spent`, `remaining`, or `progress` fields. F2 derives its visual total from the returned seven budgets only for display; the backend remains authoritative.

## 7. DTO Contract

`BudgetPlanResponse`:

| JSON property | Type | Required | Source |
|---|---|---|---|
| `id` | integer | Yes | Database |
| `year`, `month` | integer | Yes | Plan |
| `monthlyIncomeVnd` | digit-only string | Yes | Plan |
| `currency` | literal `VND` | Yes | Backend constant |
| `createdAtUtc` | ISO-8601 UTC string | Yes | Backend |
| `jars` | exactly seven `BudgetJarResponse` items | Yes | Canonical order |

`BudgetJarResponse` fields are `jarType` (stable string enum), `name` (string), `percentage` (integer), and `budgetVnd` (digit-only string). The default-jar DTO additionally contains `suggestedLogic`.

## 8. Validation and Error Contract

Use this envelope for all expected errors:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "One or more fields are invalid.",
  "errors": [
    { "field": "monthlyIncomeVnd", "code": "MUST_BE_POSITIVE", "message": "Monthly income must be greater than zero." }
  ]
}
```

`errors` is always an array. Status codes:

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Invalid year/month, missing or malformed income, or invalid persisted request shape |
| 404 | `MONTHLY_PLAN_NOT_FOUND` | No plan exists for a valid period |
| 409 | `MONTHLY_PLAN_ALREADY_EXISTS` | Unique year/month already exists, including a concurrent insert race |
| 500 | `INTERNAL_ERROR` | Unexpected failure or persisted aggregate integrity failure |

Do not expose SQL, stack traces, or schema details. Map ASP.NET model-binding failures to the same envelope.

## 9. Calculation Contract

Authoritative formula: `budget = monthlyIncomeVnd x percentage / 100`.

The approved policy must use whole-VND amounts and make the total equal income exactly. Proposed deterministic largest-remainder policy:

1. Calculate each exact product with an overflow-safe intermediate.
2. Assign `floor(product / 100)` to each jar and retain the remainder.
3. Distribute leftover VND units by descending remainder; ties use canonical jar order.
4. Verify seven non-negative budgets and `SUM(budgets) == monthlyIncomeVnd` before persistence and response.

This policy is shared by F1 creation and F2 read logic if budgets are not persisted. It remains **NOT FROZEN** until approved.

## 10. Persistence and Query Flow

F1 validates input, checks the unique period, creates the plan and seven allocations, verifies invariants, and saves the aggregate atomically in one EF Core transaction/save operation. Catch unique-index violations as `409`.

F2 and F1 read-back use `AsNoTracking()`, load the plan with allocations in one query, order by canonical jar order, validate all invariants, and map DTOs. Never return EF entities directly or fabricate partial data.

## 11. Implementation Tasks and Definition of Done

- [ ] Centralize the seven jar definitions and ordering.
- [ ] Update the EF model/migration to whole-VND integer fields and required indexes/checks.
- [ ] Implement the shared calculation/invariant service.
- [ ] Implement default-jars, create, and shared get-by-period endpoints.
- [ ] Implement stable validation, conflict, not-found, and internal-error envelopes.
- [ ] Verify F1 creates seven allocations and F2 reads the same response without a second API/calculation path.
- [ ] Keep expenses, spent/remaining, progress, and editing out of this scope.

**Backend specification:** READY for implementation design.  
**API contract:** NOT FROZEN pending rounding-policy and requirement approval.  
**F1/F2 contract:** SHARED; no separate F2 allocation endpoint.  
**Blocking issues:** 2.
