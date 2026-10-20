---
paths:
  - "frontend/src/app/core/**/*.ts"
  - "frontend/src/app/models/**/*.ts"
  - "frontend/src/app/constants/**/*.ts"
  - "frontend/src/environments/*.ts"
---

# API layer rules

- Read `.claude/knowledge/api-contract.md` before touching endpoints or DTOs. It was verified against `BudgetPlansController.cs`. Never invent fields, paths, or codes.
- One service: `core/services/budget-plan-api.service.ts` (`BudgetPlanApiService`, `providedIn: 'root'`) with methods `getDefaultJars`, `createMonthlyPlan`, `getMonthlyPlan`, `createExpense(request)`, `getSpendingByJars`.
- URLs only via `BUDGET_PLAN_ENDPOINTS` (`constants/api-endpoints.ts`), which is built from `environment.apiBaseUrl`. Add `EXPENSES` there; there is no trailing slash.
- Return typed `Observable<T>` from `HttpClient` generics. Map `HttpErrorResponse` into one typed app error (`kind: 'validation' | 'conflict' | 'not-found' | 'network' | 'server'`, `code`, `message`, `fieldErrors`). Use `status === 0` for network errors. Never surface raw bodies or stack traces.
- No automatic retry on POST. No caching of plan or spending responses (spending must reflect new expenses).
- Update `api-endpoints.spec.ts` and the service spec whenever an endpoint changes.
