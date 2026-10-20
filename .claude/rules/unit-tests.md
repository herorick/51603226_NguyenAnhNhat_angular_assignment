---
paths:
  - "frontend/src/**/*.spec.ts"
---

# Unit test rules

- Vitest + jsdom, zoneless. Import `describe/it/expect/vi` from `'vitest'` (existing convention). No Jasmine APIs, no `fakeAsync`/`tick`.
- HTTP: `provideHttpClient()` + `provideHttpClientTesting()`, `HttpTestingController.expectOne(url)`, and `http.verify()` in `afterEach`. Assert method and exact body.
- Routed pages: `RouterTestingHarness`. Navigation: `vi.spyOn(router, 'navigate')` or check `harness.routeNativeElement`.
- Assert user-visible output (text, roles, disabled state, aria attributes), not private members.
- Fixtures in `src/app/testing/`. Include zero spend, over 100%, negative remaining, and a non-canonical jar order.
- Never change production code to make a test pass without saying so. Report the bug instead.
- Patterns, commands, and the must-cover list: `.claude/knowledge/testing.md`.
