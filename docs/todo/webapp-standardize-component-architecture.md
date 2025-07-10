# Webapp Issue: Standardize on a Programmatic, Component-Based Architecture

## Issue Description

The application is built with a mix of static HTML pages and newer, programmatically generated pages. This leads to inconsistent development patterns and a fragmented user experience.

## Recommendation

Migrate all remaining static HTML pages to programmatic rendering, unify on a single modal implementation, and standardize form handling.

## Implementation Suggestions

1.  **Migrate All Pages to Programmatic Rendering:**
    *   **Action:** Convert all remaining static HTML pages (e.g., `dashboard.html`, `add-expense.html`, authentication pages like `login.html`, `register.html`, `reset-password.html`, `join-group.html`, `privacy-policy.html`, `terms-of-service.html`) to the new architecture.
    *   **Approach:** For each page, create a minimal HTML file that includes only essential meta tags, CSS links, and a root element (e.g., `<div id="app-root"></div>`). Then, load a JavaScript/TypeScript module responsible for rendering the entire page content into this root element.
    *   **Example (for `login.html`):
        ```html
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <!-- ... essential meta tags and CSS links ... -->
            <title>Splitifyd - Login</title>
        </head>
        <body>
            <div id="app-root"></div>
            <script type="module" src="./js/login-init.ts"></script> <!-- New entry point -->
        </body>
        </html>
        ```
        And then `login-init.ts` would handle rendering the login form using components.

2.  **Unify on a Single Modal Implementation:**
    *   **Action:** Deprecate all hardcoded HTML modals and refactor them to use the reusable `ModalComponent` class (`webapp/src/js/components/modal.ts`).
    *   **Approach:** Identify all instances where modals are created directly in HTML or via custom JavaScript. Replace these with calls to `ModalComponent.render()` and `ModalComponent.show()`.
    *   **Benefit:** Centralizes modal logic, styling, and behavior, making them consistent and easier to maintain.

3.  **Standardize Form Handling:**
    *   **Action:** Refactor all forms to be generated programmatically, ensuring consistent validation, submission, and error handling logic across the application.
    *   **Approach:** Utilize `FormComponents` (`webapp/src/js/components/form-components.ts`) to render form fields. Implement a consistent pattern for form submission (e.g., using `FormData` and a centralized validation utility).
    *   **Benefit:** Ensures a uniform user experience for forms and simplifies validation and submission logic.

**Next Steps:**
1.  Prioritize which static pages to convert first (e.g., authentication pages).
2.  Identify all hardcoded modals and plan their migration to `ModalComponent`.
3.  Develop a strategy for programmatic form generation and integrate it into new and refactored pages.
