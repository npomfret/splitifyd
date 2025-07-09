# Priority Action Items for JavaScript Refactoring

This document outlines the highest-priority tasks for refactoring, securing, and modernizing the `webapp/js` codebase. It consolidates findings from multiple analysis reports.

## 1. Architecture & Modernization (Priority: High)

*   **Goal:** Stabilize the application by creating a predictable, modern, and maintainable architecture.

### Action Plan:

1.  **Convert to Consistent ES6 Modules:** ✅ **COMPLETED**
    *   **Problem:** The codebase is a mix of ES6 modules, global `window` objects, and script-load-order dependencies, causing instability.
    *   **Task:** Refactor all JavaScript files to use `import`/`export` syntax. Remove all reliance on the global `window` object for module communication.
    *   **Solution:** Change all `<script>` tags to use `type="module"`. Replace `window.myApi` with `export const myApi`, and add `import` statements where needed.
    *   **COMPLETED:** All JavaScript files now use ES6 modules. Removed all legacy global assignments. All consumers updated to use explicit imports.

2.  **Centralize State Management:**
    *   **Problem:** Application state is scattered across `localStorage`, DOM attributes, and global variables, leading to synchronization bugs.
    *   **Task:** Create a single source of truth for shared application state.
    *   **Solution:** Implement a simple `store.js` using a `Proxy` object to automatically notify components of state changes. Refactor components to read from this central store.

3.  **Create a Service Layer for API Calls:**
    *   **Problem:** `fetch()` calls are scattered throughout the UI code, mixing concerns and making the code hard to test.
    *   **Task:** Consolidate all API calls into a dedicated service layer.
    *   **Solution:** Create a `webapp/js/services/` directory with modules like `apiService.js`, `authService.js`, etc. Components will call these services instead of using `fetch` directly.

4.  **Adopt a Consistent Component Pattern:**
    *   **Problem:** No consistent structure for UI components.
    *   **Task:** Define a simple lifecycle for all components.
    *   **Solution:** Each component should have `render()`, `setupEventListeners()`, and `cleanup()` methods to manage its lifecycle and prevent memory leaks.

## 2. Code Quality & Cleanup (Priority: Medium)

*   **Goal:** Improve code quality by removing duplication, fixing bad practices, and organizing the codebase.

### Action Plan:

1.  **Remove Duplicated Code:**
    *   **Problem:** The same logic for authentication checks, error display, and form validation is repeated in many files.
    *   **Task:** Abstract all duplicated logic into common utility functions.
    *   **Solution:** Create utility modules like `authUtils.js`, `uiUtils.js`, and `validation.js` to house shared logic.

2.  **Fix "Code Smells" and Bad Practices:**
    *   **Problem:** The code contains memory leaks (unremoved event listeners), uses deprecated APIs (`document.execCommand`), and has "magic numbers/strings" hardcoded.
    *   **Task:** Address these issues systematically.
    *   **Solution:**
        *   Implement `cleanup()` methods in components to remove event listeners.
        *   Replace `document.execCommand` with the modern Clipboard API (`navigator.clipboard.writeText()`).
        *   Move all hardcoded constants to a central `constants.js` file.

3.  **Consolidate Redundant Files:**
    *   **Problem:** There are overlapping files like `dashboard.js`/`dashboard-init.js` and `expense-detail.js`/`expense-detail-handlers.js`.
    *   **Task:** Merge the functionality of these files and remove the redundant ones.

4.  **Remove Unused Code and Features:**
    *   **Problem:** The codebase contains developer tools (`test-config.html`), incomplete features ("Settle Up", "Activity" tab), and unused backend code.
    *   **Task:** Remove or move these to a separate `developer_tools` directory. Either complete or remove the underdeveloped UI features.

## 3. Error Handling (Priority: Medium)

*   **Goal:** Prevent isolated errors from crashing the entire application.

### Action Plan:

1.  **Implement Error Boundaries:**
    *   **Problem:** A single JavaScript error can take down the whole UI.
    *   **Task:** Wrap key execution points in `try...catch` blocks.
    *   **Solution:** In the `catch` block, log the error and use a unified UI utility to display a friendly message to the user, allowing the rest of the application to continue functioning.