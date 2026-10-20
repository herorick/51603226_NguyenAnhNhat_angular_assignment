# F1 + F2 Monthly Planning and Income Allocation - Frontend Development Specification

## 1. Feature Overview

This document is the shared Angular contract for:

- **F1 - Monthly planning:** select a period, enter positive whole-VND income, review the seven fixed jar defaults, and create a plan.
- **F2 - Income allocation:** read the selected existing plan and display the backend-provided income allocation across the seven jars.

F1 owns the form and create action. F2 is read-only. Both use the same typed plan response from `GET /api/v1/budget-plans/{year}/{month}`. Editing rates, expenses, spent/remaining values, progress, and dashboard aggregation are out of scope.

**Source status:** F1 and F2 requirements are Draft/Proposed. The API and calculation contract are not frozen until the rounding/remainder policy is approved.

## 2. Shared API Contract

The authoritative backend contract is [spec-f1-f2-backend.md](spec-f1-f2-backend.md). The frontend uses these operations:

| Operation | Method and URL | Feature |
|---|---|---|
| Load defaults | `GET /api/v1/budget-plans/default-jars` | F1 planning form |
| Create plan | `POST /api/v1/budget-plans` | F1 create action |
| Load plan/allocation | `GET /api/v1/budget-plans/{year}/{month}` | F1 post-create view and F2 allocation view |

There is no separate F2 `/allocation` endpoint. F2 consumes the same `MonthlyPlanResponse` returned when F1 reads a plan. The frontend never submits jar types, rates, or calculated budgets.

Money fields are digit-only strings representing whole VND. Keep them as strings and never convert them to JavaScript `number` values for financial calculations.

## 3. Business Rules

| ID | Frontend behavior |
|---|---|
| F1-AC1 / BR-001 | Require a selected year/month and positive income. |
| F1-AC2 / F1-AC5 / BR-002 | Display exactly seven backend-provided, read-only jar defaults. |
| BR-004 | Display the fixed rates and total 100%; do not calculate or edit rates. |
| BR-005 through BR-007 | Render only backend-provided budgets; do not calculate authoritative amounts in Angular. |
| F1-AC4 / BR-008 | Preserve input and show the API conflict on duplicate period. |
| F2-AC1 / F2-AC4 | Show each returned jar name, percentage, and budget. |
| F2-AC3 | On missing plan, show F1 navigation and no fabricated amounts. |
| BR-009 | Accept and format whole VND only. |

## 4. User Flows and Routes

### F1 planning

1. Open `/monthly-planning`.
2. Load the backend default-jar definition.
3. Select year/month and enter income.
4. Submit once; disable duplicate submission while pending.
5. On `201 Created`, navigate to `/monthly-plans/:year/:month`.
6. The destination loads the saved plan using the shared GET endpoint.

### F2 allocation

1. Open `/monthly-plans/:year/:month` or navigate there after F1 creation.
2. Angular validates route parameters and calls the shared GET endpoint.
3. Show a stable loading state while the request is pending.
4. On success, render income and seven backend budgets.
5. On `404`, explain that F1 must create the plan and provide a link back to `/monthly-planning`.
6. On failure or malformed data, show a safe retry state and never invent amounts.

The F2 page does not create or edit a plan.

## 5. Angular Models

```typescript
export type JarType =
  | 'livingExpenses'
  | 'food'
  | 'children'
  | 'emergencyFund'
  | 'savings'
  | 'investment'
  | 'entertainmentAndTravel';

export interface DefaultJar {
  jarType: JarType;
  name: string;
  percentage: number;
  suggestedLogic: string;
}

export interface DefaultJarsResponse {
  currency: 'VND';
  totalPercentage: 100;
  jars: DefaultJar[];
}

export interface CreateMonthlyPlanRequest {
  year: number;
  month: number;
  monthlyIncomeVnd: string;
}

export interface MonthlyPlanJar {
  jarType: JarType;
  name: string;
  percentage: number;
  budgetVnd: string;
}

export interface MonthlyPlanResponse {
  id: number;
  year: number;
  month: number;
  monthlyIncomeVnd: string;
  currency: 'VND';
  createdAtUtc: string;
  jars: MonthlyPlanJar[];
}

export interface ApiError {
  code: string;
  message: string;
  errors: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}
```

## 6. Component and Service Responsibilities

| Component/service | Responsibility |
|---|---|
| `MonthlyPlanningPage` | F1 form, local validation, loading, submit, and error states |
| `IncomeAllocationPage` | F1 post-create/F2 route parsing, shared GET, retry, and page-level states |
| `DefaultJarList` | Render exactly seven read-only defaults and total 100% |
| `AllocationSummary` | Render period, monthly income, and seven returned allocations |
| `JarAllocationItem` | Render name, percentage, and formatted backend budget |
| `BudgetPlanApiService` | Own typed HTTP calls and error mapping |

No state-management framework is needed for this workflow. Do not hard-code a second frontend copy of rates or budgets.

## 7. API Service Contract

```typescript
getDefaultJars(): Observable<DefaultJarsResponse>
createMonthlyPlan(request: CreateMonthlyPlanRequest): Observable<MonthlyPlanResponse>
getMonthlyPlan(year: number, month: number): Observable<MonthlyPlanResponse>
```

Expected outcomes:

- Defaults: `200 DefaultJarsResponse`; retryable service error otherwise.
- Create: `201 MonthlyPlanResponse`, `400 VALIDATION_ERROR`, or `409 MONTHLY_PLAN_ALREADY_EXISTS`.
- Read: `200 MonthlyPlanResponse`, `400 VALIDATION_ERROR`, `404 MONTHLY_PLAN_NOT_FOUND`, or `500 INTERNAL_ERROR`.

Do not retry POST automatically after a timeout. A plan may have been created; a later retry should surface the API uniqueness response. A GET may have one user-triggered retry for the MVP.

## 8. Forms and Validation

| Control | Model | Validation |
|---|---|---|
| Period | `{ year: number \| null, month: number \| null }` | Required; year 1-9999; month 1-12 |
| Income | Canonical digit string | Required; digits only; positive integer; no sign, decimal, or fraction |
| Defaults | `DefaultJarsResponse` | Seven known unique jars; integer rates total 100%; `currency === 'VND'` |

The UI may display grouping separators, but it must normalize to ungrouped ASCII digits before validation/request creation and must not silently remove arbitrary symbols. A current-month default and localized grouping convention remain pending requirements approval.

For responses, perform a shape check before rendering: `currency` must be `VND`, there must be exactly seven known unique jar types, percentages must be integer values totaling 100%, and all money values must be digit-only strings. Do not independently replace backend arithmetic with a client calculation.

## 9. Visual and Display Contract

The F2 visual baseline is [month-budget-summary.html](../requirements/f2-income-allocation/month-budget-summary.html). Do not treat its static sample values as runtime data. Angular binds the API response.

| Reference element | Angular behavior | Data source |
|---|---|---|
| Back link | Navigate to `/monthly-planning` | UI navigation |
| `Month Budget Summary` heading | Identify the selected period | Route/response year and month |
| Month selector | Load the selected period through the shared GET endpoint | Route/API path |
| Total-income summary | Format `monthlyIncomeVnd` as VND | Response |
| `100% allocated` donut | Visualize the fixed seven rates; no client financial calculation | `jars[].percentage` |
| Seven-item legend | Render seven canonical names/rates | `jars` |
| Seven jar cards | Render name, percentage, and backend budget | `jars[]` |
| Meter bars | Optional percentage-share accent only; never bind spent/progress data | `percentage` |
| Responsive grid | Preserve readable cards and long names on narrow screens | UI layout |

F1's planning screen uses the same default-jar data but does not need to show allocated amounts before creation. F1's created-plan view and F2 may show backend `budgetVnd` because they use the shared read response. No `spent`, `remaining`, expense, or progress models may be added for these features.

## 10. Loading, Empty, Error, and Success States

- **F1 initial loading:** show a stable loading state for defaults and disable create until loaded.
- **F1 ready:** show seven defaults, total 100%, period controls, income input, and create action.
- **F1 invalid:** show field-level messages and retain entered values.
- **F1 submitting:** disable repeated submission and retain values.
- **F1 duplicate:** show the API conflict message without edit/replace behavior.
- **F1 created:** navigate to the shared plan route and load it from the API.
- **F2 loading:** show stable skeleton/text state without zero placeholders.
- **F2 success:** show income and seven allocations in canonical response order.
- **F2 missing plan:** show `MONTHLY_PLAN_NOT_FOUND` guidance and F1 link; do not show defaults or zero budgets.
- **Network/500:** show a generic message and retry action without raw server details.
- **Malformed response:** show a data-integrity error and do not render partial amounts.

## 11. Accessibility and Interaction

- Associate every label with its control and identify required fields in text.
- Make period controls, income entry, create, retry, and back actions keyboard-operable.
- Announce loading, validation, errors, and success with an appropriate live region.
- Do not communicate state or validity through color alone.
- Focus the first invalid F1 control after failed submission.
- Use a heading and landmark for the allocation view and a semantic list/table for jar values.
- Prevent overlap for long jar names and VND values on narrow screens.

## 12. FE/BE Field Mapping

| UI field | Angular model | JSON | Backend/domain |
|---|---|---|---|
| Selected period | `year`, `month` | Request or path `year`, `month` | `BudgetPlan.Year/Month` |
| Monthly income | `monthlyIncomeVnd: string` | `monthlyIncomeVnd` | `BudgetPlan.MonthlyIncomeVnd` |
| Default jar name/rate | `DefaultJar[]` | `jars[].name/percentage` | Canonical backend definition |
| Jar identifier | `JarType` | `jarType` | `BudgetAllocation.JarType` |
| Jar budget | `budgetVnd: string` | `budgetVnd` | Backend-calculated `BudgetAllocation.BudgetVnd` |
| Created plan metadata | `id`, `createdAtUtc` | Same | Database/backend generated |
| Currency | literal `VND` | `currency` | Backend constant |

## 13. UI/API Interaction

```mermaid
sequenceDiagram
    actor User as Family finance user
    participant Page as Angular page
    participant Service as BudgetPlanApiService
    participant API as ASP.NET Core API
    User->>Page: Open F1 planning
    Page->>Service: getDefaultJars()
    Service->>API: GET /api/v1/budget-plans/default-jars
    API-->>Page: 200 seven defaults
    User->>Page: Select period and enter income
    Page->>Service: createMonthlyPlan(request)
    Service->>API: POST /api/v1/budget-plans
    API-->>Page: 201 MonthlyPlanResponse
    Page->>Service: getMonthlyPlan(year, month)
    Service->>API: GET /api/v1/budget-plans/{year}/{month}
    API-->>Page: 200 shared plan/allocation response
    Page-->>User: Show created plan and F2 allocation view
```

## 14. Frontend Tasks

- [ ] Add the shared TypeScript models and typed API service.
- [ ] Build the F1 planning form and read-only default-jar list.
- [ ] Implement whole-VND string handling and accessible validation.
- [ ] Implement create pending, duplicate, network, and validation states.
- [ ] Add the shared plan route with year/month parsing and not-found handling.
- [ ] Render F1 post-create/F2 allocation using backend values only.
- [ ] Implement the HTML reference mapping, responsive seven-card layout, donut/legend, and percentage-share accents without adding progress data.

## 15. Parallel Development and Traceability

Frontend can use the DTOs and examples in [spec-f1-f2-backend.md](spec-f1-f2-backend.md) as mocks while backend implementation proceeds. Backend and frontend must update this shared pair of specifications together if an endpoint, field, enum, error, money representation, or calculation rule changes.

| Requirement | Frontend implementation |
|---|---|
| F1 create monthly plan | Period/income form, validation, create request, duplicate handling |
| F1 seven default jars | Backend-loaded read-only defaults and total 100% |
| F1 post-create view | Navigate and load shared plan response |
| F2 display seven allocations | Render names, rates, and backend budgets |
| F2 missing plan | 404 empty state with F1 navigation |
| BR-005 through BR-007 | No client financial calculation; backend values only |
| BR-009 | Whole-VND digit strings and VND formatting |
| F1/F2 out of scope | No rate editing, expense, spent, remaining, or progress UI |

## 16. Readiness

**Frontend specification:** READY for mock-based implementation.  
**API contract:** NOT FROZEN pending rounding-policy and requirement approval.  
**F1/F2 contract:** SHARED through the common plan GET response.  
**Blocking issues:** 2.
