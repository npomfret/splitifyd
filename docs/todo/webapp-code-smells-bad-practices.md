# Webapp Issue: Fix "Code Smells" and Bad Practices

## Issue Description

The code contains memory leaks (unremoved event listeners), uses deprecated APIs (`document.execCommand`), and has "magic numbers/strings" hardcoded.

## Recommendation

Address these issues systematically.

## Implementation Suggestions

1.  **Implement `cleanup()` methods in components to remove event listeners:**
    *   As outlined in `docs/todo/issues/webapp-consistent-component-pattern.md`, ensure all components have a `cleanup()` method that removes all event listeners attached by that component. Call this method when the component is no longer needed (e.g., before re-rendering, or when navigating away from a page).

2.  **✅ COMPLETED - Replace `document.execCommand` with the modern Clipboard API (`navigator.clipboard.writeText()`):**
    *   **Location:** `webapp/src/js/group-detail.ts` (within `copyShareLink` function).
    *   **Implementation:** Updated `copyShareLink` function to use modern `navigator.clipboard.writeText()` API and made it async/await based with proper error handling.

3.  **✅ COMPLETED - Move all hardcoded constants to a central `constants.js` (or `constants.ts`) file:**
    *   **Examples:**
        *   `AUTH_TOKEN_KEY` in `webapp/src/js/auth.ts`.
        *   `USER_ID_KEY` (if created) in `webapp/src/js/auth.ts`.
        *   Magic numbers like `50` for `maxAttempts` and `100` for `intervalMs` in `webapp/src/js/app-init.ts` and `webapp/src/js/add-expense.ts`.
        *   Error messages that are repeated.
    *   **Implementation:**
        *   ✅ Created `webapp/src/js/constants.ts` with centralized constants:
            ```typescript
            // webapp/src/js/constants.ts
            export const AUTH_TOKEN_KEY = 'splitifyd_auth_token';
            export const USER_ID_KEY = 'userId';
            export const MAX_AUTH_ATTEMPTS = 50;
            export const AUTH_ATTEMPT_INTERVAL_MS = 100;
            ```
        *   ✅ Updated `webapp/src/js/auth.ts` to import and use `AUTH_TOKEN_KEY` and `USER_ID_KEY`
        *   ✅ Updated `webapp/src/js/app-init.ts` to import and use `MAX_AUTH_ATTEMPTS` and `AUTH_ATTEMPT_INTERVAL_MS`
        *   ✅ Updated `webapp/src/js/utils/auth-utils.ts` to import and use the polling constants

**Next Steps:**
1.  ✅ COMPLETED - Systematically go through the codebase and identify all hardcoded values that should be constants.
2.  ✅ COMPLETED - Implement the Clipboard API replacement.
3.  **REMAINING TASK** - Ensure `cleanup()` methods are correctly implemented and called for all components.

**Status:** 2 out of 3 tasks completed. Only the cleanup() methods implementation remains.
