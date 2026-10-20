# Test Cases: F5 - Monthly Dashboard

## Traceability Summary

| Item | Value |
| --- | --- |
| User story or requirement | F5-US-01 - Review a monthly plan and its jar performance |
| Feature | F5 - Jar management / dashboard |
| Scope | Functional, UI, backend/frontend integration, accessibility smoke |
| Status | Draft - pending confirmation of progress precision, over-budget behavior, initial month selection, and product brief |
| Output location | `docs/testing/test-cases/f5/` |

## Assumptions and Open Questions

- Progress is provisionally checked as total spent divided by monthly income overall, and jar spent divided by jar budget per jar, per AC2/AC3 and assumptions A2. Confirm the definitions and displayed precision before treating non-integer percentage cases as release gates.
- Remaining balances are provisionally checked as income minus total spent and jar budget minus jar spent, per AC2/AC3 and assumption A3.
- The dashboard can select among existing plans by year and month. No default selection is asserted because the requirement does not choose between current month, most recent plan, or explicit selection.
- Jar identifying colors are compared with the corresponding plan/jar data; exact color values and visual design are not specified.
- Over-budget behavior is not asserted. Confirm whether expenses may exceed budgets and whether negative balances and progress above 100% should be displayed.
- The referenced `product-brief.md` is absent. The available F5 story is the source of expected behavior; confirm whether the missing brief adds requirements.
- No dashboard UI/API contract or execution environment is specified. Automation recommendations are provisional and should be revisited once stable selectors, response contracts, and fixtures are available.
- Authentication, performance thresholds, browser compatibility, exact number/date formatting, and full WCAG conformance are not specified and are not asserted.

## Reusable Test Data

| Data ID | Value | Use |
| --- | --- | --- |
| D01 | Plan for 2026-09, income `25,000,000 VND`; seven jars and allocations: Living Expenses 35% (`8,750,000 VND`), Food 20% (`5,000,000 VND`), Children 10% (`2,500,000 VND`), Emergency Fund 10% (`2,500,000 VND`), Savings 10% (`2,500,000 VND`), Investment 10% (`2,500,000 VND`), Entertainment & Travel 5% (`1,250,000 VND`). No expenses unless a case specifies them. | Standard plan and exact whole-VND jar budgets |
| D02 | D01 plus saved expenses: Food `1,000,000 VND`, Living Expenses `1,750,000 VND`; all other jars have no expenses. A second plan for 2026-08 has an expense of `50,000 VND`. | Overall/jar calculations, plan selection, and exclusion of another plan's expense |
| D03 | Plan for 2026-08 with no saved expenses and income `10,000,000 VND`; has exactly its seven configured jars. | Zero-spending values |
| D05 | Controlled dashboard response fixture with whole-VND backend monetary fields that are distinguishable from values produced by an independent frontend calculation; fixture conforms to the approved response contract. | Frontend contract/financial-authority check |
| D06 | A dashboard user can operate the month selector using keyboard only. | Accessibility smoke check |

## Test Cases

| Test Case ID | Title | Test Steps | Expected Result | Requirement | Testing Technique | Priority | Preconditions | Test Data | Automation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC_F5_001 | Verify the dashboard allows selection of a monthly plan by year and month | 1. Open the dashboard when at least two monthly plans exist.<br>2. Inspect the available plan choices.<br>3. Select 2026-09.<br>4. Select 2026-08. | Both existing plans can be selected and identified by year and month. The dashboard indicates the currently selected plan, and the displayed plan identity changes to match each selection. No default selection is asserted. | AC1 | Use Case Testing, State Transition Testing | High | At least two distinct monthly plans exist and are accessible. | D01, D03 | Yes - once the dashboard UI is stable |
| TC_F5_002 | Verify overall performance reflects expenses assigned to the selected plan | 1. Select the 2026-09 plan.<br>2. Inspect income, total spent, remaining balance, and overall progress.<br>3. Compare spent with the saved expenses assigned to all jars in that plan.<br>4. Compare the result with the other plan's expense. | Income is `25,000,000 VND`. Total spent is `2,750,000 VND`, the sum of D02 expenses for the selected plan; the `50,000 VND` expense in 2026-08 is excluded. Remaining balance is `22,250,000 VND`. Using the stated provisional progress formula, overall progress is `11%`. | AC2; A2, A3 | Arithmetic Invariant Testing, Equivalence Partitioning | Critical | The selected plan and all listed expenses are persisted; totals can be observed from the dashboard. | D01, D02 | Yes - once the dashboard UI and data setup are stable |
| TC_F5_003 | Verify all seven selected-plan jars show allocation and performance data | 1. Select the 2026-09 plan with D02 expenses.<br>2. Count the displayed jars.<br>3. For each jar, inspect name, identifying color, allocation rate, allocated budget, spent, remaining, and progress.<br>4. Compare each value with the selected plan's jar data and assigned expenses. | Exactly the seven D01 jars appear, once each, with their corresponding identifying colors, allocation rates, and budgets. Food shows `1,000,000 VND` spent, `4,000,000 VND` remaining, and `20%` progress. Living Expenses shows `1,750,000 VND` spent, `7,000,000 VND` remaining, and `20%` progress. Each other jar shows `0 VND` spent, remaining equal to its allocated budget, and `0%` progress. | AC3; A2, A3 | Use Case Testing, Business Rule Testing, Arithmetic Invariant Testing | Critical | D02 is persisted and each expense is associated with the stated jar in 2026-09. | D01, D02 | Yes - once the dashboard UI and data setup are stable |
| TC_F5_004 | Verify a plan without expenses displays zero spending and full remaining balances | 1. Select the 2026-08 plan.<br>2. Inspect its overall performance values.<br>3. Inspect spending, remaining balance, and progress for each jar. | Total spent is `0 VND`; remaining balance is `10,000,000 VND`; overall progress is `0%`. All seven jars show `0 VND` spent, remaining equal to their allocated budgets, and `0%` progress. | AC4 | Equivalence Partitioning, Arithmetic Invariant Testing | High | The selected plan exists and has no saved expenses. | D03 | Yes - once the dashboard UI and data setup are stable |
| TC_F5_005 | Verify a newly saved expense is reflected after viewing or refreshing the dashboard | 1. Start with D01 and no expenses.<br>2. Create and save a `500,000 VND` expense assigned to Food through the applicable expense flow.<br>3. Open or refresh the dashboard for 2026-09.<br>4. Inspect Food and overall performance. | Food spent is `500,000 VND`, remaining is `4,500,000 VND`, and progress is `10%`. Overall spent is `500,000 VND`, remaining is `24,500,000 VND`, and progress is `2%`. Values reflect the saved expense state. | AC5; AC2, AC3 | State Transition Testing, Integration Testing, Arithmetic Invariant Testing | Critical | D01 exists with no expenses; the applicable F3 expense flow is available. | D01 | Yes - end-to-end, once both flows are stable |
| TC_F5_008 | Verify displayed monetary values use backend-calculated whole-VND values | 1. Configure the frontend integration fixture to return D05's dashboard response.<br>2. Open the corresponding dashboard plan.<br>3. Compare displayed income, budgets, spent amounts, and remaining balances with the response fields.<br>4. Check that displayed monetary values contain no fractional VND. | Displayed monetary values match the corresponding backend-calculated response values as whole VND. The frontend does not replace them with independently calculated values. Exact separators and locale formatting are not asserted. | AC6; NFR financial integrity | Integration Contract Testing, Error Guessing | High | Approved dashboard response contract and a frontend integration harness are available. | D05 | Yes - when the response contract and harness are stable |
| TC_F5_009 | Verify the month selector is keyboard operable | 1. Open the dashboard without using a pointer.<br>2. Navigate to the month selector using the keyboard.<br>3. Select an existing plan and inspect the selected plan identity. | The selector and its options are reachable and operable by keyboard; visible focus is maintained; after selection, the dashboard identifies the selected year and month. This is an accessibility smoke check, not a full WCAG conformance assessment. | AC1; accessibility smoke coverage | Accessibility Smoke Testing, Use Case Testing | Medium | Dashboard is available in a browser with keyboard and focus inspection. | D06 | No - pending stable UI and accessibility contract |

## Coverage Matrix

| Acceptance Criterion | Complexity | Covered By |
| --- | --- | --- |
| AC1: Select and identify a plan by year and month | Medium | TC_F5_001, TC_F5_009 |
| AC2: Display selected plan's overall income, spending, remaining balance, and progress | Complex | TC_F5_002, TC_F5_004, TC_F5_005 |
| AC3: Display allocation and performance for exactly seven jars | Complex | TC_F5_003, TC_F5_004, TC_F5_005 |
| AC4: Display zero-spending values when a plan has no expenses | Medium | TC_F5_004 |
| AC5: Reflect created, edited, and deleted expense state | Complex | TC_F5_005 covers creation; edit and delete are not applicable per requested test scope and have no test cases. |
| AC6: Display backend-calculated whole-VND monetary values | Medium | TC_F5_002, TC_F5_003, TC_F5_008 |

## Non-Functional Coverage Notes

| Area | Coverage decision |
| --- | --- |
| Accessibility | TC_F5_009 provides keyboard/focus smoke coverage for the plan-selection interaction. Full WCAG conformance is not specified and is not claimed. |
| Security | Authentication and authorization are not specified for F5; no security behavior is asserted. |
| Performance | No response-time or availability target is specified. |
| Compatibility | Supported browsers/devices are not specified. |
| Localization | VND whole-unit values are checked; exact separators, locale, and display precision for non-integer percentages remain unspecified. |
| Integration | Expense creation to dashboard totals and backend response-to-view monetary consistency are covered by TC_F5_005 and TC_F5_008. Expense edit/delete paths are not applicable per requested test scope. |

## Risks and Open Questions

- **Business:** Confirm overall and per-jar progress definitions and display precision. Current data uses exact whole percentages, but non-integer rounding behavior is not covered.
- **Business/finance:** Confirm whether overspending is permitted and, if so, whether negative remaining balance and progress above 100% are displayed. Do not treat assumed behavior A4 as an approved expected result.
- **UX:** Confirm whether the dashboard initially selects the current month, the most recent plan, or requires explicit selection. No default-selection behavior is asserted.
- **Requirements:** Provide or confirm the missing product brief.
- **Scope:** Expense edit and delete dashboard-refresh scenarios are excluded as not applicable per request. AC5 still describes these behaviors, so they remain untested in this suite.
- **Implementation:** Confirm the dashboard UI/API contract, response fixture format, and executable test environment before automation is considered ready.

## Quality Gate

- [x] All six acceptance criteria have traceable coverage or an explicit not-applicable scope decision; AC5 edit/delete behavior is not covered by a test case.
- [x] Positive, state-change, zero-data, arithmetic, integration, and applicable accessibility smoke scenarios are included.
- [x] Test data, expected results, priorities, techniques, preconditions, and automation assessments are recorded.
- [x] Duplicate objectives are removed; each case has one primary objective.
- [x] Assumptions, risks, and unresolved questions are visible; unsupported over-budget behavior is not asserted.
- [ ] Finalize after progress semantics/precision, overspending behavior, initial month-selection behavior, and the source brief are confirmed.
- [ ] Reassess automation once the dashboard contract, stable UI, fixtures, and test environment are available.

**Decision:** Draft and ready for review. Functional coverage maps to every supplied acceptance criterion; release-readiness assertions affected by the open questions remain pending confirmation.