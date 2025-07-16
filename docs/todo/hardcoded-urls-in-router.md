# Hardcoded URLs in Router

## Problem
- **Location**: Multiple files in `webapp/src/js/` (no central router.ts exists)
- **Description**: The application uses hardcoded string paths (e.g., `'/dashboard.html'`) scattered across multiple files for navigation. This makes the application less flexible and more prone to errors if URLs change. It also makes it harder to manage and reason about the application's routing structure.
- **Current vs Expected**: Currently, URLs are strings scattered throughout various files. They should be centralized in a single object for better organization and maintainability.

## Solution
- **Approach**: Create a `ROUTES` object that defines all the application's paths. Then, refactor all files to use this object instead of hardcoded strings. This will make the code more readable, less error-prone, and easier to update.
- **Code Sample**:
  ```typescript
  // Create a new file for route constants, e.g., `webapp/src/js/routes.ts`
  export const ROUTES = {
    HOME: '/',
    DASHBOARD: '/dashboard.html',
    LOGIN: '/login.html',
    GROUP_DETAIL: '/group-detail.html',
    ADD_EXPENSE: '/add-expense.html',
    EXPENSE_DETAIL: '/expense-detail.html',
    JOIN_GROUP: '/join-group.html',
    REGISTER: '/register.html',
    RESET_PASSWORD: '/reset-password.html',
    PRICING: '/pricing.html',
    PRIVACY_POLICY: '/privacy-policy.html',
    TERMS_OF_SERVICE: '/terms-of-service.html',
    COOKIES_POLICY: '/cookies-policy.html'
  } as const;

  // In any file that needs routing
  import { ROUTES } from './routes';
  
  // When redirecting
  window.location.href = ROUTES.LOGIN;
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves maintainability and reduces the risk of routing errors)

## Implementation Plan

### Step 1: Create routes.ts (Commit 1)
- Create `/webapp/src/js/routes.ts` with all route constants
- Include all HTML pages found in the webapp

### Step 2: Update authentication files (Commit 2)
- Update `auth.ts` - handles post-login redirect to dashboard
- Update `auth-redirect.ts` - handles authentication redirects

### Step 3: Update core navigation files (Commit 3)
- Update `dashboard.ts` - redirects to login when not authenticated
- Update `groups.ts` - navigates to group detail pages
- Update `group-detail.ts` and `group-detail-handlers.ts` - handle group navigation

### Step 4: Update expense files (Commit 4)
- Update `add-expense.ts` - navigates back to group detail or dashboard
- Update `expense-detail.ts` - handles return navigation

### Step 5: Update components (Commit 5)
- Update `AddExpenseComponent.ts` - redirects after expense creation
- Update `JoinGroupComponent.ts` - redirects after joining group

### Step 6: Document HTML usage (Commit 6)
- Add documentation for HTML files that contain hardcoded links
- Since we can't import TypeScript in HTML, document the pattern for consistency

## Implementation Notes
- This change follows the existing pattern used in `constants.ts`
- Each commit is small and focused on a specific area
- The refactoring is purely mechanical with no logic changes
- TypeScript will catch any import/usage errors during build