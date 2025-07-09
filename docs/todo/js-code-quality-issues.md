# Code Quality Issues

This document details significant code quality problems in the `webapp/js` directory that increase complexity, reduce maintainability, and lead to bugs.

## 1. Code Duplication

*   **Problem:** The same or very similar blocks of code are repeated across multiple files. This violates the Don't Repeat Yourself (DRY) principle, making the code harder to maintain. A bug fix or logic change needs to be applied in every duplicated instance.
*   **Symptoms:**
    *   **Authentication Waiting Pattern:** Multiple files contain an almost identical `waitForAuthManager` or `checkAuth` function that polls for `window.authManager` to be initialized.
    *   **Message/Error Display:** Each component or page implements its own `showMessage`, `showError`, or `displayAlert` function, leading to inconsistent UI and duplicated DOM manipulation logic.
    *   **Form Validation:** Validation logic (e.g., checking if a field is empty, if an email is valid) is repeated for every form instead of using a shared, reusable utility.
    *   **Event Handler Setup:** The pattern for adding event listeners to elements is copied and pasted across different components.

### Research & Detailed Analysis

*   **Refactoring Strategy:** The primary solution to duplication is abstraction. Identify the common pattern, create a single, reusable function or component that encapsulates it, and replace all duplicated instances with a call to the new abstraction.
*   **Benefits of DRY:**
    *   **Maintainability:** Changes are made in one place.
    *   **Readability:** Code becomes more declarative and easier to understand.
    *   **Reliability:** Reduces the chance of introducing inconsistencies.

### Implementation Plan

1.  **Create a `common.js` or Utility Module:**
    *   Create a new file: `webapp/js/utils/common.js`.
    *   **`waitForAuthManager` -> `authReady()`:** Create a single, Promise-based function that resolves when the authentication service is ready. All components can `await authReady()` instead of implementing their own polling logic.
    *   **`showMessage` -> `uiUtils.js`:** Create a `uiUtils.js` file that exports standardized functions like `showSuccess(message)`, `showError(message)`, and `showInfo(message)`. These functions can manage a single, consistent notification area in the DOM.
2.  **Create a `validation.js` Module:**
    *   As mentioned in the security document, centralize all validation logic into `webapp/js/utils/validation.js`.
    *   Export functions like `isNotEmpty`, `isValidEmail`, `isStrongPassword`, etc.
    *   Refactor all forms to import and use these validators.
3.  **Abstract Event Handling:**
    *   Create a helper function, perhaps in `domUtils.js`, called `addDelegateEventListener(elementType, selector, callback)` that simplifies event delegation.

## 2. Poor Practices & "Code Smells"

*   **Problem:** The codebase contains outdated practices, anti-patterns, and "code smells" that indicate deeper issues.
*   **Symptoms:**
    *   **Memory Leaks:** Event listeners are added to elements, but they are never removed when the element is destroyed or the page changes. This is especially problematic in a single-page application-like experience where components are created and destroyed dynamically. Only `auth.js` shows any sign of cleanup.
    *   **Deprecated APIs:** `document.execCommand` is used in `group-detail.js`. This feature is obsolete and no longer recommended. Modern alternatives like the **Clipboard API** should be used.
    *   **Magic Numbers/Strings:** Hard-coded values (e.g., `setTimeout(..., 300)`, `retryLimit = 3`, `userRole = 'admin'`) are scattered throughout the code. These values lack context and are hard to change.
    *   **No Error Boundaries:** A single JavaScript error in one component can propagate and crash the entire application, leaving the user with a blank or broken page.

### Implementation Plan

1.  **Implement Cleanup Logic:**
    *   Adopt a consistent component lifecycle pattern (`init`, `render`, `destroy`).
    *   In the `destroy` method of each component, ensure all event listeners created by that component are explicitly removed using `removeEventListener`. Store references to listeners when they are created.
2.  **Replace Deprecated APIs:**
    *   Refactor the `document.execCommand` usage to use the `navigator.clipboard.writeText()` API, which is asynchronous and more secure. Provide user feedback on success or failure.
3.  **Centralize Constants:**
    *   Create a new file: `webapp/js/constants.js`.
    *   Export all "magic" values as named constants (e.g., `export const API_RETRY_LIMIT = 3;`, `export const NOTIFICATION_TIMEOUT = 5000;`).
    *   Import and use these constants throughout the application.
4.  **Introduce Error Handling:**
    *   Wrap top-level event handlers and component initialization logic in `try...catch` blocks.
    *   In the `catch` block, log the error using a centralized logger and display a user-friendly error message using the `uiUtils.js` module. Prevent the error from crashing the entire app.
