# Test Cases: F3 - Add and Assign an Expense

## Traceability Summary

| Item | Value |
| --- | --- |
| User story or requirement | F3-US-01 - Add an expense to a jar in a monthly plan |
| Feature | F3 - Add and assign an expense |
| Scope | Functional, API/integration, accessibility smoke coverage |
| Status | Draft - pending decisions on description whitespace/length, entry point, and overspending behavior |
| Output location | `docs/testing/test-cases/f3/` |

## Assumptions and Open Questions

- Each expense is created against one existing monthly plan and exactly one jar that belongs to that plan. The plan's month is the date-validation reference.
- Valid amounts are positive whole VND values. Decimal amounts are invalid; no upper amount limit is specified.
- A successful save adds the amount to the selected jar's previously spent amount. Remaining is the backend-calculated jar budget minus the resulting spent amount. Tests use values that do not exceed the budget because overspending behavior is unresolved.
- A missing plan or a jar belonging to a different plan must not result in fallback to another month or jar. Exact UI wording, API status codes, and endpoint shapes are not specified.
- A description must be non-empty. Whether whitespace-only text is empty after trimming, and the maximum description length, remain open; those values are not used as pass/fail data.
- The entry point (preselected jar/month versus general expense form) is unresolved. Cases assert the required selection and saved association, not a particular navigation or preselection design.
- F3 has no approved UI/API contract or execution environment specified. Automation candidates should be confirmed once those are available; no case assumes specific selectors or status codes.
- Authentication, performance thresholds, browser support, and detailed dashboard visualization are not specified and are not asserted. Full accessibility conformance is not specified; one basic keyboard/validation accessibility smoke case is included for the critical form flow.

## Reusable Test Data

| Data ID | Value | Use |
| --- | --- | --- |
| D01 | Existing plan for 2026-09. Food budget: 5,000,000 VND; prior spent: 600,000 VND; prior remaining: 4,400,000 VND. Other predefined jars are present. | Standard valid expense and totals verification |
| D02 | Valid expense: Food, amount `125,000 VND`, description `Market groceries`, date `2026-09-15` | Successful save |
| D03 | Amounts: empty, `0`, `-1`, `abc` | Invalid amount partitions |
| D04 | Amount `1 VND` | Positive lower boundary |
| D05 | Amount `1.5 VND` | Non-whole VND amount |
| D06 | Description `Bus fare`; selected plan month 2028-02; dates `2028-02-29`, `2028-01-31`, `2028-03-01` | Leap-month valid boundary and adjacent out-of-month dates |
| D07 | Existing plans for 2026-09 and 2026-10; one jar from each plan | Cross-month jar-membership validation |
| D08 | 2026-11 with no monthly plan; another month's plan and jars exist | Missing-plan/no-fallback validation |
| D09 | Required-field variants: jar missing, description missing, date missing | Required information validation |

## Test Cases

| Test Case ID | Title | Test Steps | Expected Result | Requirement | Testing Technique | Priority | Preconditions | Test Data | Automation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC_F3_001 | Verify expense entry offers only jars in the selected month's plan | 1. Open expense entry for 2026-09.<br>2. Inspect the available jar choices.<br>3. Select Food and inspect the selected plan/month and jar before saving. | The user can select one jar belonging to the 2026-09 plan. No jar from another month's plan is offered as a substitute. The selected month and jar are identifiable before saving. | AC1, AC5 | Use Case Testing, Business Rule Testing | High | A valid 2026-09 plan with its seven predefined jars exists. | D01, D07 | No - pending approved UI/API contract |
| TC_F3_002 | Verify a valid expense is saved and backend jar totals are updated | 1. Open expense entry for 2026-09.<br>2. Select Food.<br>3. Enter D02's amount, description, and date.<br>4. Save the expense.<br>5. Retrieve the saved expense and Food totals from the UI or backend. | One expense is persisted with amount 125,000 VND, description `Market groceries`, date 2026-09-15, the 2026-09 plan, and Food jar. The user receives save confirmation. Food spent becomes 725,000 VND and remaining becomes 4,275,000 VND. The total changes are calculated by the backend. | AC1, AC2; NFR financial integrity | End-to-End Use Case Testing, Integration Testing, Arithmetic Invariant Testing | Critical | D01 exists and the expense does not exceed the jar budget. | D01, D02 | No - pending approved UI/API contract |
| TC_F3_003 | Verify the smallest positive whole-VND amount is accepted | 1. Open expense entry for an existing plan.<br>2. Select a jar in that plan.<br>3. Enter amount `1`, a non-empty description, and a date in the plan month.<br>4. Save and inspect the persisted expense and jar totals. | The expense is saved with amount exactly 1 VND. The selected jar's spent amount increases by 1 VND and remaining is recalculated by the backend; no non-positive-amount validation message is shown. | AC2, AC3; NFR whole-VND currency | Boundary Value Analysis | High | The selected plan and jar exist; prior totals are known. | D04 | No - pending approved UI/API contract |
| TC_F3_004 | Verify empty, zero, negative, and invalid amounts are rejected | 1. For each value in D03, enter otherwise-valid expense details for an existing plan and jar.<br>2. Attempt to save.<br>3. Inspect the validation result, persisted expenses, and jar totals after each attempt. | Each value is rejected with a user-visible message that the amount must be greater than zero. No expense is persisted, and spent and remaining totals are unchanged for each attempt. | AC3 | Equivalence Partitioning, Negative Testing | Critical | The selected plan and jar exist; each variation starts from unchanged known totals. | D01, D03 | No - pending approved UI/API contract |
| TC_F3_005 | Verify a fractional-VND amount is rejected | 1. Enter `1.5` as the amount with otherwise-valid expense details.<br>2. Attempt to save.<br>3. Inspect validation feedback, persistence, and jar totals. | The fractional amount is not saved because expense amounts use whole VND. The user receives amount validation feedback, and jar totals remain unchanged. | Assumption A3; NFR whole-VND currency | Equivalence Partitioning, Negative Testing | High | The selected plan and jar exist. | D01, D05 | No - pending approved UI/API contract |
| TC_F3_006 | Verify each missing required field is reported without saving | 1. Repeat expense submission with each D09 variant while keeping all other fields valid.<br>2. Attempt to save each variation.<br>3. Inspect the message, persisted expenses, and jar totals after each attempt. | Each attempt is rejected. The user is told which required information is missing (jar, description, or date). No expense is persisted, and jar totals remain unchanged. | AC4 | Equivalence Partitioning, Negative Testing | High | An existing plan and jar are available; each variation starts from unchanged known totals. | D01, D09 | No - pending approved UI/API contract |
| TC_F3_007 | Verify expense entry for a month without a plan does not substitute another month's jars | 1. Open expense entry for 2026-11 while another month's plan exists.<br>2. Inspect the resulting form or empty state.<br>3. Attempt to submit an expense for 2026-11 if submission is available. | The user is informed that a monthly plan is required. No jars from another month are offered or silently selected. No expense is saved and no jar totals change. | AC5 | Negative Testing, State Transition Testing | Critical | No plan exists for 2026-11; another month's plan and jars exist. | D07, D08 | No - pending approved UI/API contract |
| TC_F3_008 | Verify a jar from a different monthly plan cannot receive the expense | 1. Start an expense for the 2026-09 plan.<br>2. Submit a request or selection using a jar that belongs only to the 2026-10 plan.<br>3. Inspect the validation response, persistence, and both plans' jar totals. | The operation is rejected as an invalid plan/jar selection. No expense is persisted, no alternative jar is substituted, and totals for both plans remain unchanged. | AC5 | Decision Table Testing, API Negative Testing | Critical | Both plans and their distinct jars exist; request-level validation can be exercised if the UI prevents an invalid selection. | D07 | No - pending approved UI/API contract |
| TC_F3_009 | Verify dates outside the selected plan month are rejected | 1. For the 2028-02 plan, enter an otherwise-valid expense dated 2028-01-31 and attempt to save.<br>2. Repeat with date 2028-03-01.<br>3. Inspect validation feedback, persistence, and jar totals after each attempt. | Both dates are rejected with a message that the expense date must be within the selected month. Neither expense is persisted, and jar totals remain unchanged. | AC6 | Boundary Value Analysis, Negative Testing | Critical | A 2028-02 plan and one of its jars exist; prior totals are known. | D06 | No - pending approved UI/API contract |
| TC_F3_010 | Verify the final calendar date of a leap-year plan month is accepted | 1. Open expense entry for the 2028-02 plan.<br>2. Select a jar in that plan and enter a positive whole-VND amount, description, and date 2028-02-29.<br>3. Save and inspect the stored date and jar totals. | The leap-day date is accepted as within February 2028. The expense is persisted with 2028-02-29 and associated with the selected plan and jar; backend totals reflect the expense. | AC2, AC6 | Boundary Value Analysis, Use Case Testing | High | A valid 2028-02 plan exists and the chosen amount does not exceed the jar budget. | D06 | No - pending approved UI/API contract |
| TC_F3_011 | Verify backend totals are authoritative when an expense is saved | 1. Record known persisted totals for a selected jar.<br>2. Save a valid expense using only the expense details defined by the API contract.<br>3. If the contract exposes calculated totals as request fields, submit deliberately stale totals as well.<br>4. Retrieve the backend's persisted spent and remaining values. | The backend derives spent and remaining from persisted jar budget and expenses; it does not trust client-calculated totals. Persisted values equal the baseline plus the valid expense amount and the corresponding remaining calculation. If calculated totals are not accepted by the contract, no such client fields are required. | AC2; NFR backend financial source of truth | Integration Testing, Error Guessing, Arithmetic Invariant Testing | Critical | A valid plan and jar with known budget and prior totals exist; request contract is available. | D01, D02 | No - pending approved UI/API contract |
| TC_F3_012 | Verify expense form controls and validation feedback are keyboard accessible | 1. Open expense entry using keyboard navigation.<br>2. Reach and operate the plan/month, jar, amount, description, date, and save controls without a pointer.<br>3. Submit an invalid amount and inspect focus and error announcement/association. | All required controls are keyboard reachable and operable in a logical order, focus remains visibly identifiable, and the amount validation message is programmatically associated with or announced for the relevant field. The user can correct the value and retry. | AC1, AC3; accessibility smoke coverage | Accessibility Smoke Testing, Use Case Testing | Medium | Expense form is available in a browser with keyboard interaction and accessibility inspection. | D01, D03 | No - pending stable UI and test environment |

## Coverage Matrix

| Acceptance Criterion | Complexity | Covered By |
| --- | --- | --- |
| AC1: Select a jar from the requested month's plan | Medium | TC_F3_001, TC_F3_002 |
| AC2: Save a valid expense, update totals, confirm save | Complex | TC_F3_002, TC_F3_003, TC_F3_010, TC_F3_011 |
| AC3: Reject missing, zero, negative, or invalid amount | Medium | TC_F3_003, TC_F3_004, TC_F3_005, TC_F3_012 |
| AC4: Reject missing jar, description, or date | Medium | TC_F3_006 |
| AC5: Reject unavailable plan or jar from another month, with no substitution | Complex | TC_F3_001, TC_F3_007, TC_F3_008 |
| AC6: Reject expense dates outside the selected plan month | Medium | TC_F3_009, TC_F3_010 |
| NFR: Whole-VND values and backend financial calculations | Complex | TC_F3_002, TC_F3_003, TC_F3_005, TC_F3_011 |

## Non-Functional Coverage Notes

| Area | Coverage decision |
| --- | --- |
| Accessibility | TC_F3_012 is a focused keyboard and validation-feedback smoke check. A full WCAG 2.2 assessment is not specified by the story and is not claimed. |
| Security | Authentication is not specified. Invalid values and cross-plan association are covered at the validation boundary; broader OWASP testing belongs to the application security suite. |
| Performance | No response-time, availability, or load target is specified. |
| Compatibility | Browser and device support are unspecified. |
| Localization | VND and whole-VND storage are required; thousands separators and localized date/amount formatting are unspecified and not asserted. |
| Integration | Save persistence, cross-plan validation, and backend-calculated totals are covered by TC_F3_002, TC_F3_008, and TC_F3_011. |

## Risks and Open Questions

- **Business/finance:** Confirm whether expenses may exceed remaining jar balance and whether an over-budget warning is required. No spending-cap behavior is asserted.
- **UX:** Confirm whether expense entry starts from a dashboard jar or a general form. Cases intentionally do not require a particular starting point or preselection behavior.
- **Data:** Confirm whether whitespace-only descriptions are rejected after trimming and define the maximum description length. These cases validate an empty description only.
- **Business:** Confirm whether one save may contain only one expense. Cases assume one expense per save, as stated by this user story.
- **Implementation:** Approve the F3 UI/API contract and test environment before assigning executable automation. Expected API status codes and error payload schemas remain unspecified.

## Quality Gate

- [x] All six acceptance criteria and applicable stated financial rules have traceable coverage.
- [x] Positive, negative, boundary, business-rule, persistence, and integration scenarios are included where applicable.
- [x] Test data, expected results, priorities, techniques, and preconditions are recorded.
- [x] Duplicate objectives have been removed; each case has one primary objective.
- [x] Assumptions, risks, and unresolved decisions are visible.
- [x] Accessibility smoke coverage is included; full accessibility, security, performance, and compatibility scope is explicitly bounded.
- [ ] Finalize automation assessment after the F3 UI/API contract and environment are available; resolve product questions before asserting affected behavior.

**Decision:** Draft and ready for review. Functional acceptance criteria are covered; behavior affected by the listed open questions remains out of pass/fail scope.