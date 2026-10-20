# Test Cases: F1 - Monthly Planning

## Traceability Summary

| Item | Value |
| --- | --- |
| User story or requirement | F1-US-01 - Create a monthly income plan |
| Feature | F1 - Monthly planning |
| Scope | Functional, API/integration, accessibility smoke coverage |
| Status | Draft - pending confirmation of the default-jar creation contract |
| Output location | `docs/testing/test-cases/f1/` |

## Assumptions and Open Questions

- The month selector submits a year and month, and the selected month can be inspected after creation.
- A valid income is a positive whole-VND amount. Decimal and maximum-income limits are not defined by the story; they are excluded from these cases except where the current API contract is explicitly tested.
- The seven default jars and percentages are fixed exactly as listed in AC5.
- The system may expose the flow through a UI, API, or both. UI cases validate user-visible behavior; API cases validate backend source-of-truth behavior.
- **Implementation risk:** the current API request model accepts caller-supplied allocations, while F1 requires the system to create the seven predefined jars. The cases require the observable F1 outcome and should fail if callers can create arbitrary jar sets through the F1 path.
- The open questions in the requirement about default month, duplicate-plan navigation, and income formatting are not asserted.
- Authentication and authorization are out of scope because the story explicitly excludes authentication.

## Reusable Test Data

| Data ID | Value | Use |
| --- | --- | --- |
| D01 | Year `2026`, month `9` (September), income `25,000,000 VND` | Standard valid plan |
| D02 | Year `2026`, month `10` (October), income `1 VND` | Positive lower boundary |
| D03 | Raw income inputs: empty, `0`, `-1`, `abc` | Verify digit-only filtering and validation of the resulting empty or zero values |
| D04 | Existing plan for year `2026`, month `9` | Duplicate-plan validation |
| D05 | Default jars: Living Expenses 35%, Food 20%, Children 10%, Emergency Fund 10%, Savings 10%, Investment 10%, Entertainment & Travel 5% | Fixed business rule validation |

## Test Cases

| Test Case ID | Title | Test Steps | Expected Result | Requirement | Testing Technique | Priority | Preconditions | Test Data | Automation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC_F1_001 | Verify the monthly planning form exposes month, income, and create controls | 1. Open the monthly planning screen.<br>2. Inspect the available form controls. | A year/month selector is available; a required monthly-income input is available and identifies VND; a create-plan action is available. | AC1 | Use Case Testing, Accessibility smoke | High | Application is available and the user can access the monthly planning screen. | D01 | Yes |
| TC_F1_002 | Verify a valid income creates one monthly plan and opens the jar dashboard | 1. Select September 2026.<br>2. Enter `25,000,000` in the income field.<br>3. Submit the form.<br>4. Inspect the resulting screen and persisted plan. | The submission succeeds; exactly one plan exists for 2026-09 with income 25,000,000 VND; the user is shown the current month's jar dashboard. | AC2 | Use Case Testing, State Transition Testing | Critical | No plan exists for 2026-09; all required services are running. | D01 | Yes |
| TC_F1_003 | Verify the positive-income lower boundary is accepted | 1. Select a month with no existing plan.<br>2. Enter `1` VND.<br>3. Submit the form. | The plan is created successfully because income is greater than zero; the created plan retains income `1 VND`; no validation error is shown. | AC2, AC3 | Boundary Value Analysis | High | The selected month has no plan. | D02 | Yes |
| TC_F1_004 | Verify income input filters non-digits and rejects empty or zero values | 1. Enter each raw value in D03 into the income field.<br>2. Verify that `abc` becomes empty and `-1` becomes `1` because only digits are retained.<br>3. Submit the empty, zero, and filtered-to-empty values.<br>4. Inspect the field value, validation message, and whether a create request was sent. | The field retains digits only (`-1` becomes `1`; `abc` becomes empty). Empty and zero values show a positive-income validation message and do not send a create request. The normalized `1` value is not submitted as an invalid amount. | AC3 | Equivalence Partitioning, Negative Testing | Critical | Default jars are loaded; an isolated UI test environment is available. | D03 | Yes |
| TC_F1_005 | Verify duplicate submission for the same year and month is prevented | 1. Ensure a plan already exists for September 2026.<br>2. Select September 2026 and enter a positive income.<br>3. Submit the form.<br>4. Count plans for 2026-09 and inspect the user message. | The second submission is rejected with a duplicate-plan message; the count remains one; the original plan and income are unchanged. | AC4 | Decision Table Testing, State Transition Testing | Critical | D04 exists and is valid. | D01, D04 | Yes |
| TC_F1_006 | Verify a newly created plan contains exactly the seven predefined jars | 1. Create a plan for a previously unused month with valid income.<br>2. Retrieve the created plan from the dashboard or API.<br>3. Count the jars and compare names with D05. | The plan contains exactly seven jars: Living Expenses, Food, Children, Emergency Fund, Savings, Investment, and Entertainment & Travel. No jar is missing, duplicated, added, or renamed. | AC2, AC5 | Equivalence Partitioning, Business Rule Testing | Critical | The selected month has no plan. | D01, D05 | Yes |
| TC_F1_007 | Verify predefined jar percentages total exactly 100 percent | 1. Create a valid monthly plan.<br>2. Read every jar percentage from the dashboard or API.<br>3. Sum the percentages without rounding the displayed values. | The seven percentages are 35%, 20%, 10%, 10%, 10%, 10%, and 5%; their exact total is 100%; the dashboard indicates full allocation if such an indicator is shown. | AC2, AC5 | Decision Table Testing, Arithmetic Invariant Testing | Critical | The selected month has no plan. | D01, D05 | Yes |
| TC_F1_008 | Verify the predefined jar names and rates cannot be replaced by arbitrary allocations in the F1 flow | 1. Start a new monthly-plan creation request for an unused month.<br>2. Attempt to provide a custom jar name, omit a predefined jar, or submit a non-default percentage set while keeping the income positive.<br>3. Inspect the created plan or rejection. | The F1 flow does not create a plan with arbitrary jars or rates. It either creates the exact seven default jars and rates or rejects the request with a clear validation response. | AC5, NFR financial integrity | Negative Testing, Error Guessing | High | An isolated API/UI test environment is available and the selected month has no plan. | Custom jar `Custom`, omitted `Food`, or altered rate set | Yes |
| TC_F1_009 | Verify backend allocation amounts are calculated from income and default rates | 1. Create a plan with income `25,000,000 VND`.<br>2. Retrieve the plan allocations from the backend.<br>3. Compare each amount with income multiplied by its default rate.<br>4. Sum all persisted allocation amounts. | The backend, not the submitted/displayed client amount, calculates allocation amounts. Expected amounts are Living Expenses 8,750,000; Food 5,000,000; Children 2,500,000; Emergency Fund 2,500,000; Savings 2,500,000; Investment 2,500,000; Entertainment & Travel 1,250,000 VND. The persisted amount total equals 25,000,000 VND. | NFR financial integrity, monthly-income-allocation requirement | Integration Testing, Arithmetic Invariant Testing | Critical | The backend and database are available; the selected month has no plan. | D01, D05 | Yes |
| TC_F1_010 | Verify the API rejects allocation percentages whose total is not 100 percent | 1. Send a valid-year, valid-month, positive-income create request with allocation percentages totaling 99% or 101%.<br>2. Inspect the response and database. | The API rejects the request with a total-allocation validation error; no plan or allocations are persisted. | AC2, AC5, NFR financial integrity | Boundary Value Analysis, Negative Testing | High | The selected month has no plan; request validation endpoint is available. | Income 25,000,000; totals 99% and 101% | Yes |
| TC_F1_011 | Verify invalid year and month values are rejected without persistence | 1. Submit a positive-income request with year below the supported minimum and above the supported maximum.<br>2. Submit requests with month `0` and `13`.<br>3. Inspect responses and database state. | Each invalid request is rejected with a year/month validation message; no monthly plan is created. | AC1, Main Workflow step 5 | Boundary Value Analysis, API Negative Testing | Medium | The API validation contract is in force and each test uses an unused year/month combination. | Years `1999`, `2101`; months `0`, `13`; positive income | Yes |
| TC_F1_012 | Verify the created plan remains available after navigating away and returning | 1. Create a valid plan.<br>2. Navigate away from the monthly dashboard.<br>3. Return to the selected month's plan/dashboard.<br>4. Refresh the page or re-fetch the plan. | The same plan, income, seven jars, and percentages are shown after retrieval; no duplicate plan is created by navigation or refresh. | AC2, AC4 | State Transition Testing, Persistence Testing | High | A valid plan has been created for the selected month. | D01, D05 | Yes |

## Coverage Matrix

| Acceptance Criterion | Complexity | Covered By |
| --- | --- | --- |
| AC1: Display the monthly planning form | Simple | TC_F1_001, TC_F1_011 |
| AC2: Create a monthly plan with valid income | Complex | TC_F1_002, TC_F1_003, TC_F1_006, TC_F1_007, TC_F1_009, TC_F1_012 |
| AC3: Reject missing or non-positive income | Medium | TC_F1_003, TC_F1_004 |
| AC4: Prevent duplicate monthly plans | Medium | TC_F1_005, TC_F1_012 |
| AC5: Use the predefined default jars | Complex | TC_F1_006, TC_F1_007, TC_F1_008, TC_F1_009, TC_F1_010 |
| NFR: Use VND and preserve backend financial integrity | Complex | TC_F1_002, TC_F1_003, TC_F1_009, TC_F1_010 |

## Non-Functional Coverage Notes

| Area | Coverage decision |
| --- | --- |
| Accessibility | TC_F1_001 is an accessibility smoke case for labels, keyboard-reachable controls, visible focus, and observable validation targets. A full WCAG 2.2 audit is not included because the story requests basic usability only. |
| Security | Authentication and authorization are explicitly out of scope. Input validation is covered through TC_F1_004, TC_F1_008, and TC_F1_010; injection-specific testing belongs to the broader API security suite. |
| Performance | Not applicable to the stated acceptance criteria; no response-time target or load profile is defined. |
| Compatibility | Not specified; browser/device matrix is deferred until the frontend implementation and support matrix are approved. |
| Localization | VND is required, but locale formatting and thousand-separator behavior are open questions, so exact formatting is not asserted. |
| Integration | Backend persistence and API response integrity are covered by TC_F1_002, TC_F1_009, TC_F1_010, and TC_F1_012. |

## Quality Gate

- [x] All applicable requirements and acceptance criteria are covered.
- [x] Positive, negative, boundary, and business-rule scenarios are included where applicable.
- [x] Test data, expected results, priorities, and techniques are complete.
- [x] Duplicate scenarios are removed.
- [x] Assumptions, risks, and open questions are visible.
- [ ] Finalize the artifact after confirming whether default jars are generated by the backend or submitted by the frontend.

**Decision:** Draft and ready for review. Automation is recommended for all cases once the F1 UI/API contract and test environment are available.