# Priority Action Items

This document outlines the highest-priority tasks for refactoring and securing the `webapp/js` codebase. The items are ordered to deliver the most impact first, focusing on security and stability.

## 1. Immediate Security Fixes (Priority: Critical) ✅ COMPLETED

*   **Goal:** To close the most severe XSS vulnerabilities and prevent injection attacks. This is the top priority and should be completed before any other major refactoring.

### Action Plan:

1.  **Eliminate `innerHTML` Usage:** ✅ COMPLETED
    *   **Task:** Systematically search for and replace every instance of `.innerHTML` where it is used with user-controllable data.
    *   **Tools:** Use `grep -r ".innerHTML" webapp/js/` to find all occurrences.
    *   **Solution:**
        *   For simple text content, switch to `.textContent`.
        *   For HTML structures, use a safe DOM creation utility (`safe-dom.js`) that relies on `document.createElement` and `appendChild`.
    *   **Estimated Effort:** Medium. This is a widespread issue.
    *   **COMPLETED:** Refactored groups.js renderGroupCard method and modal.js to use safe DOM creation instead of innerHTML with user data.

2.  **Implement Client-Side Input Sanitization:** ✅ COMPLETED
    *   **Task:** Create and apply a basic sanitization utility for all form inputs.
    *   **Solution:** Create a `validation.js` utility with functions like `isSafeString()`. Apply these checks before using any input data.
    *   **Estimated Effort:** Low.
    *   **COMPLETED:** Added sanitizeText, isSafeString, and validateInput functions to safe-dom.js utility.

3.  **Implement Content Security Policy (CSP):** ✅ COMPLETED
    *   **Task:** Configure a restrictive CSP header in the deployment environment.
    *   **Solution:** This is a configuration change in `firebase.json`. A strict policy should be drafted that only allows scripts and styles from the application's own origin.
    *   **Estimated Effort:** Low to Medium (requires testing to ensure it doesn't break legitimate functionality).
    *   **COMPLETED:** Added CSP header to firebase.json with appropriate policies for Firebase services and external resources.

## 2. Architecture Refactoring (Priority: High)

*   **Goal:** To stabilize the application by creating a predictable and maintainable architecture. This will make future development faster and safer.

### Action Plan:

1.  **Convert to Consistent ES6 Modules:**
    *   **Task:** Refactor all JavaScript files to use `import`/`export` syntax and remove reliance on the global `window` object.
    *   **Solution:** Change `<script>` tags to `type="module"`, replace `window.myApi` with `export const myApi`, and add `import` statements where needed.
    *   **Estimated Effort:** High. This is a fundamental change that will touch every JavaScript file.

2.  **Centralize State Management:**
    *   **Task:** Create a single source of truth for shared application state.
    *   **Solution:** Implement a simple `store.js` using a `Proxy` object. Refactor components to read from this store and subscribe to its changes, rather than managing their own local, duplicated state.
    *   **Estimated Effort:** Medium.

3.  **Create a Service Layer for API Calls:**
    *   **Task:** Consolidate all `fetch()` calls into a dedicated service layer.
    *   **Solution:** Create a `services/` directory with modules like `apiService.js`. Components will no longer make direct API calls.
    *   **Estimated Effort:** Medium.

## 3. Code Cleanup & Quality (Priority: Medium)

*   **Goal:** To improve code quality by removing duplication and fixing bad practices.

### Action Plan:

1.  **Remove Duplicated Implementations:**
    *   **Task:** Abstract all duplicated logic into common utility functions.
    *   **Targets:** `waitForAuthManager` logic, `showMessage`/`showError` functions, form validation patterns.
    *   **Solution:** Create `authUtils.js`, `uiUtils.js`, and `validation.js`.
    *   **Estimated Effort:** Medium.

2.  **Implement Consistent Error Handling:**
    *   **Task:** Prevent isolated errors from crashing the application.
    *   **Solution:** Wrap key execution points (event handlers, component initializations) in `try...catch` blocks that log the error and show a user-friendly message.
    *   **Estimated Effort:** Low to Medium.

## 4. Performance Optimization (Priority: Low)

*   **Goal:** To improve the responsiveness and speed of the application. These are important but should be addressed after the critical security and architectural issues are resolved.

### Action Plan:

1.  **Implement Debouncing for Inputs:**
    *   **Task:** Prevent excessive event firing for search fields and other frequent inputs.
    *   **Solution:** Create and apply a `debounce` utility.
    *   **Estimated Effort:** Low.

2.  **Optimize List Rendering:**
    *   **Task:** Refactor list rendering to perform targeted DOM updates instead of full re-renders.
    *   **Solution:** Use a keyed-list strategy and functions that `add`, `update`, and `remove` individual items.
    *   **Estimated Effort:** Medium.
