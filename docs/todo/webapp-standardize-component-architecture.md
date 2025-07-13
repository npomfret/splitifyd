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

## Status: READY TO START
Task analyzed and implementation plan created.

## Current Architecture Assessment

The webapp has a solid component foundation:
- **BaseComponent**: Abstract base class with lifecycle management
- **ModalComponent**: Well-implemented reusable modal system
- **FormComponents**: Utility class for programmatic form generation
- **PageLayoutComponent**: Layout management system

### Pages Requiring Conversion (Priority Order)

**Phase 1: Authentication Forms (Small commit)**
1. `reset-password.html` - Convert inline submit button to ButtonComponent
2. Audit and complete `login.html` and `register.html` component usage

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

## Implementation Strategy

Each phase will:
1. Convert minimal HTML with only essential meta tags and root element
2. Create/update TypeScript init files for programmatic rendering
3. Use existing component architecture (BaseComponent, FormComponents, etc.)
4. Maintain consistent styling and functionality
5. Test functionality in emulator before moving to next phase

**Next Steps:**
1. Start with Phase 1: Authentication forms conversion
2. Focus on `reset-password.html` first as it has clear inline button issues
3. Ensure each phase results in a working, testable state
