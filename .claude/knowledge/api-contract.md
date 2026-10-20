# API Contract (verified against backend code)

Source of truth: `backend/FamilyFinance.Api/Controllers/BudgetPlansController.cs` + `DTOs/*.cs`.
Specs in `docs/design/spec-*-backend.md` agree except where noted in `discrepancies.md`.
JSON is camelCase. Base URL: `environment.apiBaseUrl` (`https://localhost:54535`; http `:54536`).

## Endpoints

| Feature | Method + path | Success | Errors |
|---|---|---|---|
| F1 defaults | `GET /api/v1/budget-plans/default-jars` | 200 `DefaultJarsResponse` | 500 |
| F1 create | `POST /api/v1/budget-plans` | 201 `MonthlyPlanResponse` | 400 `VALIDATION_ERROR`, 409 `MONTHLY_PLAN_ALREADY_EXISTS`, 500 |
| F2/F3 read plan | `GET /api/v1/budget-plans/{year}/{month}` | 200 `MonthlyPlanResponse` | 400 `VALIDATION_ERROR`, 404 `MONTHLY_PLAN_NOT_FOUND`, 500 |
| F3 create expense | `POST /api/v1/budget-plans/expenses` (no trailing slash) | 201 `CreateExpenseResponse` | 400 `VALIDATION_ERROR` / `JAR_NOT_IN_MONTHLY_PLAN`, 404 `MONTHLY_PLAN_NOT_FOUND`, 500 |
| F5 spending | `GET /api/v1/budget-plans/{year}/{month}/spending-by-jars` | 200 `SpendingByJarsResponse` | 400, 404 `MONTHLY_PLAN_NOT_FOUND`, 500 `INTERNAL_ERROR` |

`BUDGET_PLAN_ENDPOINTS` in `frontend/src/app/constants/api-endpoints.ts` lacks the expenses URL — add `EXPENSES: apiUrl('/api/v1/budget-plans/expenses')`.

## TypeScript models (exact wire names)

```ts
export type JarType = 'livingExpenses' | 'food' | 'children' | 'emergencyFund'
  | 'savings' | 'investment' | 'entertainmentAndTravel';

export interface DefaultJar { jarType: JarType; name: string; percentage: number; suggestedLogic: string; }
export interface DefaultJarsResponse { currency: 'VND'; totalPercentage: number; jars: DefaultJar[]; }

export interface CreateMonthlyPlanRequest { year: number; month: number; monthlyIncomeVnd: string; }
export interface MonthlyPlanJar { jarType: JarType; name: string; percentage: number; budgetVnd: string; }
export interface MonthlyPlanResponse {
  id: number; year: number; month: number; monthlyIncomeVnd: string;
  currency: 'VND'; createdAtUtc: string; jars: MonthlyPlanJar[];
}

export interface CreateExpenseRequest { expenseDate: string; jarType: JarType; amountVnd: string; description: string; }
export interface CreatedExpense {
  id: number; expenseDate: string; jarType: JarType; jarName: string;
  amountVnd: string; description: string; createdAtUtc: string;
}
export interface JarSpendingSummary {
  jarType: JarType; jarName: string; percentage: number;
  budgetVnd: string; spentVnd: string; remainingVnd: string; // remainingVnd may start with '-'
}
export interface CreateExpenseResponse { expense: CreatedExpense; jarSummary: JarSpendingSummary; }

export interface SpendingByJar {
  jarType: JarType; jarName: string;
  percentageUsed: number;          // JSON number, 2 decimals, can exceed 100
  plannedBudgetVnd: string; spentBudgetVnd: string;
}
export interface SpendingByJarsResponse { year: number; month: number; currency: 'VND'; jars: SpendingByJar[]; }

export interface ApiFieldError { field: string; code: string; message: string; }
export interface ApiErrorResponse { code: string; message: string; errors: ApiFieldError[]; } // errors always an array
```

Note: plan jars use `name`; expense/spending use `jarName`. Do not unify on the wire.

## Server validation (mirror on client for UX only)

| Field | Codes | Rule |
|---|---|---|
| `year` / `month` | `OUT_OF_RANGE` | year 1-9999, month 1-12 |
| `monthlyIncomeVnd`, `amountVnd` | `REQUIRED`, `INVALID_FORMAT`, `MUST_BE_POSITIVE` | ASCII digits only, fits int64, > 0 |
| `expenseDate` | `REQUIRED`, `INVALID_FORMAT` | `YYYY-MM-DD` |
| `jarType` | `REQUIRED`, `INVALID_VALUE` | one of the 7 `JarType` values |
| `description` | `REQUIRED`, `TOO_LONG` | trimmed non-empty, max 500 chars |
| any wrong JSON type | `INVALID_VALUE` | model-binding failure, field name camelCased |

Map `errors[].field` to form controls; show `message` from the envelope, never raw bodies.

## Behaviour gotchas

- **CORS allows only `http://localhost:4400`.** Default `ng serve` uses 4200, so real API calls fail with CORS. Run `npx ng serve --port 4400` (or set `port` in angular.json serve options).
- API uses a dev HTTPS cert on `:54535`; the browser must trust it (`dotnet dev-certs https --trust`).
- Path params use `{year:int}`: non-numeric segments give a bare 404 with no envelope. Validate route params in Angular before calling.
- Expense create derives the plan from `expenseDate` year/month. It never receives year/month.
- 409 duplicate and 404 not-found bodies carry `errors: []`.
- Jars are returned in canonical order (see `domain-rules.md`). Render as returned; never sort.
- Do not auto-retry POSTs (a timed-out create may have succeeded). GETs may have a user-triggered retry.
- Backend README POST example (`monthlyIncome`, `allocations`) is stale. Ignore it.
