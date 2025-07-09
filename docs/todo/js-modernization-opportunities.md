# Modernization Opportunities

This document outlines a strategic roadmap for modernizing the vanilla JavaScript codebase in `webapp/js` without adopting a large framework. The goal is to improve code quality, security, and maintainability by leveraging modern JavaScript features and patterns.

## 1. Core Utilities

*   **Problem:** The codebase lacks a shared foundation of utilities, leading to widespread code duplication and inconsistency.
*   **Solution:** Create a set of small, focused utility modules that provide common functionality. This is the first step towards building a more robust and maintainable application.

### Implementation Plan

1.  **Centralized Event Bus:**
    *   **Purpose:** To allow decoupled communication between components. Instead of components calling each other's methods directly, they can emit and listen for global events.
    *   **File:** `webapp/js/utils/event-bus.js`
    *   **Implementation:** Can be a simple wrapper around `window.addEventListener` and `new CustomEvent()`.
        ```javascript
        export const on = (event, callback) => window.addEventListener(event, callback);
        export const emit = (event, data) => window.dispatchEvent(new CustomEvent(event, { detail: data }));
        ```

2.  **Safe DOM Manipulation Library:**
    *   **Purpose:** To eliminate XSS vulnerabilities from `innerHTML` and simplify DOM creation.
    *   **File:** `webapp/js/utils/safe-dom.js`
    *   **Implementation:**
        *   `$(selector, scope = document)`: A simple query selector utility.
        *   `createElement(tag, attributes = {}, children = [])`: A function to programmatically create elements.
        *   `render(element, component)`: A function to safely render components into the DOM.

3.  **Templating System:**
    *   **Purpose:** To replace unsafe string concatenation for building HTML.
    *   **Approach:** Use tagged template literals. A function is created to process a template literal, automatically sanitizing any dynamic parts.
    *   **File:** `webapp/js/utils/templates.js`
    *   **Example:** `const sanitizedHTML = html`<p>${userInput}</p>`;`

4.  **State Management with Proxies:**
    *   **Purpose:** To create a single source of truth for application state and automatically update the UI when state changes.
    *   **File:** `webapp/js/store.js`
    *   **Implementation:** Use a JavaScript `Proxy` to wrap the state object. The `set` handler of the proxy can trigger a custom event (e.g., `state-changed`) that components listen for to re-render themselves.

## 2. Security Hardening

*   **Problem:** The application has significant security holes that need to be addressed systematically.
*   **Solution:** Implement multiple layers of security, from code-level best practices to browser-level security features.

### Implementation Plan

1.  **Replace `innerHTML`:**
    *   **Action:** Conduct a full audit of the codebase for `innerHTML` usage.
    *   **Replacement:** Use `textContent` for text and the new `safe-dom.js` utility for creating HTML structures.
2.  **Sanitization Utilities:**
    *   **File:** `webapp/js/utils/sanitizer.js`
    *   **Implementation:** Create simple functions like `sanitizeText(str)` that can be used to strip potentially harmful characters before data is used.
3.  **Content Security Policy (CSP):**
    *   **Purpose:** A powerful browser feature (delivered via HTTP headers) that helps prevent XSS by defining which sources of content (scripts, styles, images) are allowed to be loaded.
    *   **Action:** This is a server-side configuration change. A strict CSP should be implemented in the Firebase Hosting configuration (`firebase.json`).
    *   **Example Policy:** `default-src 'self'; script-src 'self' https://apis.google.com;`

## 3. Component & Module Architecture

*   **Problem:** The lack of a clear architecture makes the code hard to reason about and maintain.
*   **Solution:** Define and enforce a consistent architecture for modules and UI components.

### Implementation Plan

1.  **Universal ES6 Modules:**
    *   **Action:** Convert all `.js` files to be proper ES6 modules using `import`/`export`.
    *   **Tooling:** Update all `<script>` tags to use `type="module"`.
2.  **Consistent Component Pattern:**
    *   **Purpose:** Define a simple, predictable structure for all UI components.
    *   **Pattern:** Each component should be a function or class that returns a DOM element and has:
        *   `render()`: A function that generates the component's DOM structure.
        *   `setupEventListeners()`: A function to bind event listeners.
        *   `cleanup()`: A function to remove event listeners and prevent memory leaks.
3.  **Service Layer:**
    *   **Purpose:** To centralize all external interactions, primarily API calls.
    *   **Directory:** `webapp/js/services/`
    *   **Files:** `apiService.js`, `authService.js`, etc.
    *   **Benefits:**
        *   Separates UI logic from data-fetching logic.
        *   Provides a single place to manage API-related concerns like headers, error handling, and retries.
        *   Makes components easier to test by allowing services to be mocked.
