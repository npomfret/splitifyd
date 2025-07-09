# Architecture & Design Problems

This document outlines significant architectural issues in the `webapp/js` directory that hinder maintainability, scalability, and stability.

## 1. Module System Chaos

*   **Problem:** The codebase lacks a consistent module strategy. It's a mix of modern ES6 modules, older script-style files that attach objects to the global `window` object, and files that are implicitly dependent on the load order of `<script>` tags in HTML.
*   **Symptoms:**
    *   **Inconsistent Module Usage:** `logger.js` and `safe-dom.js` might use `export`, while `api.js` and `firebase-config.js` create `window.api` and `window.firebaseAuth`.
    *   **Global Namespace Pollution:** Over-reliance on global variables (`window.authManager`, `window.api`) creates tight coupling between components and makes it difficult to track dependencies. Changes to one file can unexpectedly break another.
    *   **Fragile Load Order:** The application is likely to break if the order of `<script>` tags in the HTML files is changed. This makes dependency management a manual and error-prone process.

### Research & Detailed Analysis

*   **Modern Standard: ES6 Modules (`import`/`export`):** This is the standard for writing modular JavaScript. It allows for static analysis, better dead-code elimination by bundlers, and creates lexical scoping for modules, preventing global namespace pollution. All modern browsers support ES6 modules.
*   **Transition Strategy:** A full transition to ES6 modules is the recommended approach. This involves:
    1.  Ensuring all JavaScript files are served with the `type="module"` attribute in the script tag.
    2.  Removing all code that assigns to or reads from the `window` object for module-like behavior.
    3.  Using `import` and `export` statements to explicitly declare dependencies.

### Implementation Plan

1.  **Establish ES6 Modules as the Standard:**
    *   Update all `<script>` tags in `.html` files to include `type="module"`.
    *   This immediately changes the scope of each file from global to module-level.
2.  **Refactor Globals to Exports:**
    *   **Identify globals:** Search for `window.` assignments (e.g., `window.api = ...`).
    *   **Convert to `export`:** In each file that defines a global, remove the `window.` assignment and instead export the functionality. For example, in `api.js`, `window.api = ...` becomes `export const api = ...`.
3.  **Refactor Global Consumers to Imports:**
    *   **Identify consumers:** Search for code that uses the globals (e.g., `window.api.getExpenses()`).
    *   **Convert to `import`:** In each consuming file, add an `import` statement at the top. For example: `import { api } from './api.js';`.
4.  **Create a Dependency Map:**
    *   As part of the refactoring, document the dependencies between the new modules. This will clarify the application's architecture.

## 2. State Management Issues

*   **Problem:** Application state is scattered, duplicated, and managed inconsistently. There is no single source of truth.
*   **Symptoms:**
    *   **Scattered State:** State is held in `localStorage`, DOM element attributes (e.g., `data-group-id`), global variables, and various class instances.
    *   **Synchronization Bugs:** Because the same piece of data (e.g., the current user's information) is stored in multiple places, it's easy for them to become out of sync, leading to inconsistent UI and bugs.
    *   **DOM as State:** Using the DOM to store data is slow and mixes concerns. The DOM should be a reflection of the state, not the state itself.

### Implementation Plan

1.  **Introduce a Simple State Store:**
    *   Create a new file: `webapp/js/store.js`.
    *   Implement a simple, centralized state management object. A `Proxy` object can be used to automatically trigger UI updates on state changes.
    *   **Example Store Structure:**
        ```javascript
        const state = {
          user: null,
          currentGroup: null,
          expenses: [],
          // ...
        };

        // Use a Proxy to "watch" for changes
        export const store = new Proxy(state, {
          set(target, property, value) {
            target[property] = value;
            // Trigger an event that components can listen to
            window.dispatchEvent(new CustomEvent('state-change', { detail: { property } }));
            return true;
          }
        });
        ```
2.  **Refactor Components to Use the Store:**
    *   Identify all places where state is currently stored.
    *   Modify the code to read from the central `store` instead.
    *   Use the `state-change` event to trigger re-rendering of components when relevant data changes.

## 3. Code Organization Problems

*   **Problem:** Code is not well-organized. Files and classes have too many responsibilities, and there's no clear separation of concerns.
*   **Symptoms:**
    *   **Mixed Responsibilities:** A single function might handle a user click, make an API call, process the data, and then directly manipulate the DOM.
    *   **Monolithic Classes:** `AuthManager` and `FirebaseConfigManager` are "god objects" that do too much, making them hard to test and maintain.
    *   **No Service Layer:** API fetch logic is scattered throughout various UI components.

### Implementation Plan

1.  **Create a Service Layer:**
    *   Create a directory: `webapp/js/services/`.
    *   Create files like `apiService.js`, `authService.js`, `groupService.js`.
    *   Centralize all `fetch` calls into this layer. For example, `apiService.js` would contain all functions for interacting with the backend API.
    *   Components will call functions from the service layer instead of making `fetch` requests directly.
2.  **Refactor Components:**
    *   Break down large components into smaller, more focused ones.
    *   Separate logic:
        *   **Event Handlers:** Should only capture user input and call other functions.
        *   **Service Calls:** Should be responsible for data fetching.
        *   **Rendering:** Should be responsible for updating the DOM based on state.
3.  **Decompose Monolithic Classes:**
    *   Break down `AuthManager` into smaller, more focused modules like `authState`, `authUI`, and `authService`.
