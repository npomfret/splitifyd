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

## Status: PHASE 1 COMPLETE 
Phase 1 (Authentication Forms) completed successfully.

## Current Architecture Assessment

The webapp has a solid component foundation:
- **BaseComponent**: Abstract base class with lifecycle management
- **ModalComponent**: Well-implemented reusable modal system
- **FormComponents**: Utility class for programmatic form generation
- **PageLayoutComponent**: Layout management system

### Pages Requiring Conversion (Priority Order)

**Phase 1: Authentication Forms (Small commit)** ✅ COMPLETED
1. ✅ `reset-password.html` - Converted to component-based architecture using ResetPasswordComponent
2. TODO: Audit and complete `login.html` and `register.html` component usage

**Phase 2: Complex Forms (Small commit)**  
3. `add-expense.html` - Convert to use FormComponents for consistent form handling
4. `join-group.html` - Standardize form implementation

**Phase 3: Data Display Pages (Small commit)**
5. `expense-detail.html` - Convert to programmatic rendering
6. `group-detail.html` - Convert to programmatic rendering

**Phase 4: Content Pages (Small commit)**
7. `index.html` - Landing page conversion (mostly static content)
8. Policy pages (`privacy-policy.html`, `terms-of-service.html`, `cookies-policy.html`)

**Phase 5: Verification (Small commit)**
9. Audit all modal usage to ensure ModalComponent usage
10. Test all converted pages
11. Remove any unused static HTML patterns

## Implementation Plan

The migration will be executed in phases to ensure a stable, incremental transition. Each phase will result in a distinct, testable, and committable unit of work.

### Phase 1: Convert `reset-password.html` (First Commit)

**Goal:** Convert the static `reset-password.html` page to be programmatically rendered, removing the inline `onclick` handler in favor of a component-based approach.

**Detailed Steps:**

1.  **Analyze `reset-password.html`:**
    *   Examine `webapp/src/reset-password.html` to understand its structure, form elements, and the inline JavaScript used for submission.
    *   Identify the `sendPasswordReset()` function call that needs to be moved into a component.

2.  **Create `reset-password-init.ts`:**
    *   Create a new entry point file: `webapp/src/js/reset-password-init.ts`.
    *   This script will be responsible for initializing and rendering the page content.

3.  **Create `ResetPasswordComponent.ts`:**
    *   Create a new component file: `webapp/src/js/components/ResetPasswordComponent.ts`.
    *   This component will extend `BaseComponent` and encapsulate the entire UI and logic for the reset password page.
    *   It will use `PageLayoutComponent` to create the main page structure.
    *   It will use `AuthCardComponent` to create the main card.
    *   It will use `FormComponents.createInput` for the email field.
    *   It will use `ButtonComponent` for the "Send Reset Email" button. The `onClick` handler for this button will contain the logic from the original `sendPasswordReset()` function.

4.  **Refactor `reset-password.html`:**
    *   Strip `webapp/src/reset-password.html` down to a minimal HTML skeleton.
    *   The `<body>` should only contain `<div id="app-root"></div>` and the script tag pointing to the new init file: `<script type="module" src="./js/reset-password-init.ts"></script>`.
    *   Remove the old `<script>` block containing `sendPasswordReset`.

5.  **Update Build & Verification:**
    *   Ensure the new `reset-password-init.ts` is included in the build process.
    *   Run `npm run build` and `npm test`.
    *   Manually test the "Reset Password" page in the browser to confirm it is visually and functionally identical to the original.

---

*This plan has been created. I will await instructions before proceeding with the implementation.*
