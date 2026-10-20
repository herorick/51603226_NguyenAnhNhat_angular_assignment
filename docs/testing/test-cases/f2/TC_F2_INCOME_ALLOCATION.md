# Test Cases: F2 - Allocate Income to Seven Jars

## Traceability Summary

| Item | Value |
| --- | --- |
| User story or requirement | F2-US-01 - View monthly income allocated across seven jars |
| Feature | F2 - Allocate income to seven jars |
| Scope | Functional, API/integration |
| Status | Draft - pending confirmation of monetary precision and architecture model |
| Output location | `docs/testing/test-cases/f2/` |

## Assumptions and Open Questions

- F2 reads an existing monthly plan and does not create or update it; plan creation belongs to F1.
- The seven jars and rates in the F2 story and domain rules are the expected test oracle, despite the five-jar model currently described in `docs/design/architecture.md`.
- VND amounts are whole numbers. Rounding mode and remainder allocation are unresolved, so amounts for income values producing fractional jar results cannot be finalized or used as a release gate yet.
- Users can select only existing monthly plans, so the no-plan scenario in AC3 is not applicable to this user flow.
- F2 has no approved wireframe or response-time target. UI layout details, performance thresholds, authentication, and authorization are not asserted.
- AC2's expected-value notation is interpreted using the formula in AC1 and BR-006: monthly income multiplied by rate, divided by 100.

## Reusable Test Data

| Data ID | Value | Use |
| --- | --- | --- |
| D01 | Existing plan for 2026-09, income `25,000,000 VND`; Living Expenses 35%, Food 20%, Children 10%, Emergency Fund 10%, Savings 10%, Investment 10%, Entertainment & Travel 5% | Exact whole-VND happy path; expected amounts are 8,750,000; 5,000,000; 2,500,000; 2,500,000; 2,500,000; 2,500,000; 1,250,000 VND, respectively |
| D02 | Existing plan for a month with income `1 VND` and the seven predefined rates | Rounding/remainder behavior; exact per-jar expected amounts pending approval |
| D03 | Controlled F2 API fixture returning seven whole-VND amounts that differ from values produced by a client-side calculation | Verify the view renders backend-supplied amounts without recalculating; fixture is for frontend contract testing only |

## Test Cases

| Test Case ID | Title | Test Steps | Expected Result | Requirement | Testing Technique | Priority | Preconditions | Test Data | Automation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC_F2_001 | Verify an existing plan displays all seven jar rates and backend-calculated budgets | 1. Open the existing plan for 2026-09.<br>2. Inspect the jar names, rates, and budget amounts.<br>3. Sum the seven displayed amounts. | Exactly one row/card is shown for each predefined jar: Living Expenses 35%, Food 20%, Children 10%, Emergency Fund 10%, Savings 10%, Investment 10%, and Entertainment & Travel 5%. Their displayed amounts are respectively 8,750,000; 5,000,000; 2,500,000; 2,500,000; 2,500,000; 2,500,000; and 1,250,000 VND. The amount total is exactly 25,000,000 VND. | AC1, AC2; BR-002, BR-004, BR-006, BR-007, BR-009 | Use Case Testing, Business Rule Testing, Arithmetic Invariant Testing | Critical | A valid plan matching D01 exists and can be retrieved. | D01 | Yes |
| TC_F2_002 | Verify the allocation view displays backend-supplied amounts without client-side recalculation | 1. Configure the frontend test fixture to return D03's plan response.<br>2. Open the allocation view for that plan.<br>3. Compare every displayed amount with the amount field returned by the fixture. | Each displayed jar amount exactly matches its corresponding backend response amount, including values intentionally distinguishable from a frontend formula calculation. The frontend does not replace, recalculate, or redistribute the returned amounts. | AC4 | Integration Contract Testing, Error Guessing | High | A frontend test harness can provide a controlled plan API response. | D03 | Yes |
| TC_F2_003 | Verify fractional jar calculations use the approved whole-VND and remainder policy | 1. Open the existing plan using D02.<br>2. Record all seven returned and displayed jar amounts.<br>3. Sum the seven amounts and compare them with the monthly income.<br>4. Compare each amount with the approved rounding and remainder-allocation specification when available. | After the precision policy is approved, every amount is a whole VND value, each allocation follows that exact policy, and the sum is exactly 1 VND. Until then, this case is blocked: do not assert a particular rounding mode or which jar receives a remainder. | AC1, AC2; BR-006, BR-007, BR-009; Open Question (rounding/remainder) | Boundary Value Analysis, Arithmetic Invariant Testing | Critical | A plan with D02 exists; the approved monetary precision and remainder rule is available before execution can pass. | D02 | No - expected result is not fully specified |

## Coverage Matrix

| Acceptance Criterion | Complexity | Covered By |
| --- | --- | --- |
| AC1: Display the seven allocated jar budgets, rates, and amounts | Complex | TC_F2_001, TC_F2_004 |
| AC2: Calculate a plan with whole-VND results | Complex | TC_F2_001, TC_F2_004 |
| AC3: Do not show calculated amounts without a monthly plan | Not applicable | No case: users cannot select a month without an existing plan. |
| AC4: Use backend-calculated amounts | Medium | TC_F2_001, TC_F2_003 |
| BR-007: Sum of jar budgets equals monthly income | Complex | TC_F2_001; TC_F2_004 is blocked pending the precision rule |

## Non-Functional Coverage Notes

| Area | Coverage decision |
| --- | --- |
| Accessibility | Not specified in F2; defer a dedicated accessibility case until the allocation view and interaction design are available. |
| Security | Authentication and authorization are not specified for this story; no security cases are added. |
| Performance | No response-time or availability target is specified. |
| Compatibility | Browser/device support is not specified. |
| Localization | VND and whole-VND values are required; locale separators and exact formatting are unspecified, so separator formatting is not asserted. |
| Integration | Backend response-to-view consistency is covered by TC_F2_001 and TC_F2_003. |

## Assumptions and Risks Requiring Resolution

- **Business/finance:** Approve the rounding mode and remainder-allocation rule. TC_F2_004 cannot be finalized until this is specified, and AC2 needs a matching precise expected-value rule.
- **Architecture:** Reconcile the five-jar description in `docs/design/architecture.md` with the seven-jar F2 requirement and domain rules before implementation contract freeze.
- **UX:** Define the allocation view/wireframe if exact UI behavior is required.

## Quality Gate

- [x] All currently testable acceptance criteria and applicable business rules have traceable cases.
- [x] Positive, negative, boundary, and business-rule scenarios are included where applicable.
- [x] Test data, expected results, priorities, and techniques are recorded.
- [x] Duplicate scenarios are removed; each case has a distinct primary objective.
- [x] Assumptions, risks, and open questions are visible.
- [ ] Finalize after approving monetary precision/remainder behavior and reconciling the architecture's jar count.

**Decision:** Draft and ready for review. TC_F2_004 and release readiness remain blocked by unresolved rounding/remainder behavior; architecture consistency also needs confirmation.