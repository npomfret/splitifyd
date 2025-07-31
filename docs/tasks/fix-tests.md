# Fix Failing E2E Tests

## Tests to Fix:
1. dashboard.e2e.test.ts - 13 failures
2. group-details.e2e.test.ts - strict mode violations
3. static-pages.e2e.test.ts - missing navigation elements
4. homepage.e2e.test.ts - URL routing issues

## Implementation Plan:

### Phase 1: Fix Strict Mode Violations (group-details.e2e.test.ts)
- Problem: User displayName appears in multiple places causing `getByText` to match multiple elements
- Solution: Use more specific selectors or `.first()` to target the intended element
- Files to modify:
  - `webapp-v2/e2e/group-details.e2e.test.ts`
  - Possibly update page objects if needed

### Phase 2: Fix Navigation Issues (static-pages.e2e.test.ts)
- Problem: "Back to Home" link is missing from login page
- Solution: Either add the missing link to the UI or update the test to match current UI
- Files to check:
  - `webapp-v2/src/pages/Login.tsx`
  - `webapp-v2/e2e/static-pages.e2e.test.ts`

### Phase 3: Fix URL Routing (homepage.e2e.test.ts)
- Problem: Tests expect `/v2` prefix but app uses root URLs
- Solution: Update test expectations to match actual routing
- Files to modify:
  - `webapp-v2/e2e/helpers/index.ts` (V2_URL constant)
  - `webapp-v2/e2e/homepage.e2e.test.ts`

### Phase 4: Fix Dashboard Navigation (dashboard.e2e.test.ts)
- Problem: Sign out functionality varies across devices/browsers
- Solution: Make selectors more flexible to handle different UI patterns
- Files to modify:
  - `webapp-v2/e2e/dashboard.e2e.test.ts`
  - Consider creating a SignOutHelper utility

## Approach:
1. Start with the simplest fixes (strict mode violations)
2. Verify each fix by running the specific test
3. Handle UI differences between desktop and mobile
4. Update tests to match current UI rather than changing the UI (unless it's a bug)
5. Ensure all tests use page objects where appropriate

## Success Criteria:
- All tests in the 4 files pass consistently
- No console errors during test runs
- Tests work across all browsers (Chromium, Firefox, WebKit, Mobile variants)