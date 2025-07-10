# Webapp Issue: Fix "Code Smells" and Bad Practices

## Issue Description

The code contains memory leaks (unremoved event listeners), uses deprecated APIs (`document.execCommand`), and has "magic numbers/strings" hardcoded.

## Recommendation

Address these issues systematically.

## Implementation Suggestions

1.  **Implement `cleanup()` methods in components to remove event listeners:**
    *   As outlined in `docs/todo/issues/webapp-consistent-component-pattern.md`, ensure all components have a `cleanup()` method that removes all event listeners attached by that component. Call this method when the component is no longer needed (e.g., before re-rendering, or when navigating away from a page).

2.  **Replace `document.execCommand` with the modern Clipboard API (`navigator.clipboard.writeText()`):**
    *   **Location:** `webapp/src/js/group-detail.ts` (within `copyShareLink` function).
    *   **Old Code:**
        ```typescript
        document.execCommand('copy');
        ```
    *   **New Code:**
        ```typescript
        navigator.clipboard.writeText(shareLink.value)
            .then(() => {
                showMessage('Link copied to clipboard!', 'success');
            })
            .catch(err => {
                showMessage('Failed to copy link', 'error');
                console.error('Clipboard API write failed:', err);
            });
        ```

3.  **Move all hardcoded constants to a central `constants.js` (or `constants.ts`) file:**
    *   **Examples:**
        *   `AUTH_TOKEN_KEY` in `webapp/src/js/auth.ts`.
        *   `USER_ID_KEY` (if created) in `webapp/src/js/auth.ts`.
        *   Magic numbers like `50` for `maxAttempts` and `100` for `intervalMs` in `webapp/src/js/app-init.ts` and `webapp/src/js/add-expense.ts`.
        *   Error messages that are repeated.
    *   **Implementation:**
        *   Create `webapp/src/js/constants.ts`.
        *   Define constants:
            ```typescript
            // webapp/src/js/constants.ts
            export const AUTH_TOKEN_KEY = 'splitifyd_auth_token';
            export const USER_ID_KEY = 'userId';
            export const MAX_AUTH_ATTEMPTS = 50;
            export const AUTH_ATTEMPT_INTERVAL_MS = 100;
            // ... other constants
            ```
        *   Import and use these constants in relevant files.

**Next Steps:**
1.  Systematically go through the codebase and identify all hardcoded values that should be constants.
2.  Implement the Clipboard API replacement.
3.  Ensure `cleanup()` methods are correctly implemented and called for all components.
