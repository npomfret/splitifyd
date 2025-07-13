# Hardcoded URLs in Router

## Problem
- **Location**: `webapp/src/js/router.ts`
- **Description**: The router uses hardcoded string paths (e.g., `'/dashboard.html'`) to define routes and for redirects. This makes the application less flexible and more prone to errors if URLs change. It also makes it harder to manage and reason about the application's routing structure.
- **Current vs Expected**: Currently, URLs are strings scattered throughout the routing logic. They should be centralized in a single object or enum for better organization and maintainability.

## Solution
- **Approach**: Create a `ROUTES` object or enum that defines all the application's paths. Then, refactor the router to use this object instead of hardcoded strings. This will make the code more readable, less error-prone, and easier to update.
- **Code Sample**:
  ```typescript
  // Create a new file for route constants, e.g., `webapp/src/js/routes.ts`
  export const ROUTES = {
    HOME: '/',
    DASHBOARD: '/dashboard.html',
    LOGIN: '/login.html',
    // ... other routes
  } as const;

  // In `webapp/src/js/router.ts`
  import { ROUTES } from './routes';

  const routes: Route[] = [
    { path: ROUTES.DASHBOARD, handler: initDashboard, auth: 'required' },
    // ... other routes
  ];

  // When redirecting
  window.location.href = ROUTES.LOGIN;
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves maintainability and reduces the risk of routing errors)

## Implementation Notes
This change will make the routing logic much cleaner and easier to manage. It's a good practice to centralize all application constants, including routes, in one place.