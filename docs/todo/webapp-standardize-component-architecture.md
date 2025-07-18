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

## Status: PHASE 2 COMPLETE 
Phase 1 (Authentication Forms) and Phase 2 (Complex Forms - add-expense) completed successfully.

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

**Phase 2: Complex Forms (Small commit)** ✅ COMPLETE
3. ✅ `add-expense.html` - Converted to use AddExpenseComponent with FormComponents
4. ✅ `join-group.html` - Converted to JoinGroupComponent with component-based architecture

**Phase 3: Data Display Pages (In Progress)**
5. ✅ `expense-detail.html` - Converted to ExpenseDetailComponent with programmatic rendering
6. `group-detail.html` - Convert to programmatic rendering (Next)

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

### Phase 2: Convert `add-expense.html` (Completed)

**Goal:** Convert the static `add-expense.html` page to use component-based architecture with programmatic form generation.

**Completed Steps:**

1. **Created `add-expense-init.ts`:**
   - Entry point that mounts AddExpenseComponent to app-root
   - Includes warning-banner.js import for consistency

2. **Created `AddExpenseComponent.ts`:**
   - Extends BaseComponent with full lifecycle management
   - Uses PageLayoutComponent for consistent layout
   - Uses HeaderComponent for navigation header
   - Uses FormComponents for all form fields
   - Uses ButtonComponent for action buttons
   - Supports both add and edit modes
   - Implements proper form validation
   - Handles equal and custom expense splitting
   - Manages member selection with checkboxes
   - Updates custom split inputs dynamically

3. **Refactored `add-expense.html`:**
   - Converted to minimal HTML skeleton
   - Contains only app-root div and necessary script imports
   - Removed all hardcoded HTML forms and components

4. **Key Features Preserved:**
   - Full expense creation functionality
   - Expense editing capability
   - Form validation with error messages
   - Dynamic member selection
   - Equal/custom split options
   - Real-time split amount calculations
   - Navigation and logout functionality

**Note:** The old `add-expense.ts` file should be removed as it's no longer used.

---

### Phase 3: Data Display Pages - Detailed Implementation Plan

**Goal:** Convert `expense-detail.html` and `group-detail.html` to programmatic component-based rendering.

#### **Assessment**
Both pages are currently hybrid implementations:
- Static HTML templates with TypeScript logic
- Mix of component usage and direct DOM manipulation
- Complex functionality that needs to be preserved

#### **Commit 1: Convert `expense-detail.html`**

**Analysis:** Currently uses `initializeExpenseDetailPage()` with direct DOM manipulation. Has expense display, payer info, split breakdown, and edit/delete functionality.

**Steps:**
1. **Create `expense-detail-init.ts`:**
   - Entry point that mounts ExpenseDetailComponent
   - Include warning-banner.js import for consistency

2. **Create `ExpenseDetailComponent.ts`:**
   - Extend BaseComponent with lifecycle management
   - Use PageLayoutComponent for consistent layout
   - Use HeaderComponent for navigation
   - Create programmatic expense display (amount, description, date, category)
   - Create programmatic payer info with avatar
   - Create programmatic split breakdown table
   - Implement edit/delete permissions logic
   - Handle loading states and error handling
   - Integrate with ExpenseService and apiService
   - Use ModalComponent for delete confirmation

3. **Refactor `expense-detail.html`:**
   - Strip to minimal HTML skeleton
   - Body contains only app-root div and script tag
   - Remove all hardcoded HTML structure

4. **Preserve Key Features:**
   - Full expense data display
   - Payer information with avatar
   - Split breakdown showing participant shares
   - Edit/delete functionality for expense creator
   - Receipt display structure (even if not fully implemented)
   - Loading states and error handling
   - Delete confirmation modal

**Validation:** Run `npm run build` and `npm test`. Manual testing of expense detail page functionality.

#### **Commit 2: Convert `group-detail.html`**

**Analysis:** Currently uses `initializeGroupDetailPage()` with complex state management. Has group header, tab navigation, balance summary, expense list with pagination, and group settings.

**Steps:**
1. **Create `group-detail-init.ts`:**
   - Entry point that mounts GroupDetailComponent
   - Include warning-banner.js import for consistency

2. **Create `GroupDetailComponent.ts`:**
   - Extend BaseComponent with lifecycle management
   - Use PageLayoutComponent for consistent layout
   - Use HeaderComponent for navigation
   - Create programmatic group header with member avatars
   - Create programmatic tab navigation (Balances/Expenses)
   - Create programmatic balance summary display
   - Create programmatic expense list with pagination
   - Use ModalComponent for group settings and member invitation
   - Use ButtonComponent for action buttons
   - Implement proper state management for tab switching
   - Handle "Load More" pagination functionality
   - Integrate with group services and balance calculations

3. **Extract Sub-Components (if needed):**
   - `TabNavigationComponent` for tab switching
   - `BalanceSummaryComponent` for balance display
   - `ExpenseListComponent` for paginated expense list
   - `GroupHeaderComponent` for group info and actions

4. **Refactor `group-detail.html`:**
   - Strip to minimal HTML skeleton
   - Body contains only app-root div and script tag
   - Remove all hardcoded HTML structure

5. **Preserve Key Features:**
   - Group header with name and member avatars
   - Tab navigation between Balances and Expenses
   - Balance summary with user balances and simplified debts
   - Expense list with pagination and "Load More"
   - Group settings modal (edit name, manage members, delete)
   - Member invitation modal with shareable link generation
   - Add expense and invite members actions

**Validation:** Run `npm run build` and `npm test`. Manual testing of all group detail page functionality including tab navigation and modals.

#### **Key Implementation Guidelines**

1. **Component Architecture:**
   - Follow existing patterns from AddExpenseComponent
   - Use BaseComponent lifecycle management
   - Implement proper cleanup for event listeners
   - Use PageLayoutComponent for consistent layout

2. **State Management:**
   - Convert global variables to component instance properties
   - Implement proper cleanup for timers and event listeners
   - Handle component communication properly

3. **Avoid Common Mistakes:**
   - No inline event handlers (use addEventListener)
   - Let errors bubble up - avoid unnecessary try/catch
   - Run build and fix all TypeScript errors immediately
   - Test both emulator and production environments

4. **Testing Strategy:**
   - Run existing integration tests after each commit
   - Manual testing of all page functionality
   - Verify no regression in user experience

**Success Criteria:**
- Both pages render identically to current implementation
- All functionality preserved (editing, deleting, navigation, modals)
- No TypeScript errors or build failures
- Consistent component architecture with other converted pages
- Proper cleanup and lifecycle management

### Phase 3 Progress Update

#### Commit 1: ✅ COMPLETED - expense-detail.html conversion
- Created ExpenseDetailComponent.ts with full functionality
- Updated expense-detail-init.ts to mount the component
- Converted expense-detail.html to minimal skeleton (app-root only)
- Preserved all functionality: expense display, payer info, split breakdown, edit/delete permissions
- Implemented modal-based delete confirmation with proper lifecycle
- Successfully built and tested

**Additional work completed:** Removed all app-specific branding (Split App 2, Splitify, splitifyd) from the codebase as requested.

#### Commit 2: NEXT - group-detail.html conversion
Ready to implement GroupDetailComponent following the same pattern.

*Phase 3 Commit 1 is complete. Ready to proceed with Commit 2 when instructed.*
