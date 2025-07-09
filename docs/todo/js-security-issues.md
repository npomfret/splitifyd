# Critical Security Issues

This document outlines critical security vulnerabilities in the `webapp/js` directory, focusing on Cross-Site Scripting (XSS) and related injection flaws.

## 1. XSS Vulnerabilities via `innerHTML`

*   **Problem:** The application extensively uses `innerHTML` to render dynamic content. This is a well-known XSS vector because it parses and executes any embedded scripts within the provided string. User-controlled data (e.g., expense descriptions, group names) is directly inserted into these `innerHTML` assignments without proper sanitization.
*   **Locations:**
    *   `webapp/js/components/auth-card.js`
    *   `webapp/js/components/list-components.js`
    *   `webapp/js/components/modal.js`
*   **Risk:** High. An attacker could inject malicious scripts that steal user session tokens, redirect users to phishing sites, or perform actions on behalf of the user.

### Research & Detailed Analysis

*   **OWASP A3:2021 - Injection:** This vulnerability falls under the broader category of injection flaws. The root cause is the failure to separate untrusted data from the command/query interpreter (in this case, the browser's HTML parser).
*   **Safe Alternatives:** The recommended best practice is to avoid `innerHTML` entirely. Instead, use safer APIs that treat data as text, not executable code:
    *   `element.textContent`: Assigns a string as plain text, preventing any HTML parsing.
    *   `document.createElement()` and `element.appendChild()`: Programmatically create and append DOM nodes. This is the most secure method as it clearly separates structure (elements) from content (text).
    *   `DOMParser` with `Sanitizer API` (experimental but promising for future use) or a third-party library like `DOMPurify` if complex HTML rendering is unavoidable.

### Implementation Plan

1.  **Create a Safe DOM Utility:**
    *   Create a new file: `webapp/js/utils/safe-dom.js`.
    *   This utility will export functions for common DOM operations.
    *   `safeSetHTML(element, htmlString)`: A function that uses `DOMPurify` (if added as a dependency) to sanitize the HTML before setting `innerHTML`.
    *   `safeAppend(element, child)`: A wrapper for `appendChild`.
    *   `createAndAppend(parent, tagName, { text, classes })`: A helper to create an element, set its text content, add CSS classes, and append it to a parent.

2.  **Systematic Refactoring:**
    *   **Prioritize:** Start with the most critical areas, such as those handling user-generated content (expense details, group information).
    *   **Grep for `innerHTML`:** Use `grep -r "innerHTML" webapp/js/` to find all occurrences.
    *   **Replace:** For each occurrence, analyze the required HTML structure.
        *   If the content is purely text, replace `element.innerHTML = value` with `element.textContent = value`.
        *   If the content requires HTML structure, refactor to use `document.createElement()` and `appendChild()` via the new `safe-dom.js` utility.
    *   **Verification:** Manually test each refactored component to ensure the UI renders correctly and that script injection is no longer possible.

## 2. No Input Sanitization

*   **Problem:** Form inputs are read directly from DOM elements (`.value`) and used in API calls and UI rendering without being sanitized or validated on the client-side.
*   **Risk:** Medium. While server-side validation should be the ultimate protection, the lack of client-side checks leads to a poor user experience and opens the door for basic injection attacks that could be caught early.

### Implementation Plan

1.  **Create a Validation Utility:**
    *   Create a new file: `webapp/js/utils/validation.js`.
    *   Export functions like `isValidEmail()`, `isNotEmpty()`, `isSafeString()` (checks for HTML characters).
2.  **Apply Validation:**
    *   On form submission, before making API calls, pass the input values through the validation functions.
    *   Display user-friendly error messages next to the invalid fields.
    *   Disable submission buttons until the form is valid.

## 3. Unsafe DOM Manipulation

*   **Problem:** Similar to the `innerHTML` issue, there are instances of direct DOM manipulation where data is concatenated into strings to create HTML attributes or content.
*   **Locations:** `webapp/js/expense-detail.js`, `webapp/js/group-detail.js`.

### Implementation Plan

1.  **Audit and Refactor:**
    *   Review all instances of string-based DOM creation.
    *   Refactor to use `element.setAttribute()` for attributes and `element.textContent` for content.
    *   Ensure any user-provided URLs in `href` or `src` attributes are validated to prevent `javascript:` URI attacks.
