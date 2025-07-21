# Task: Abstract API Calls with a Data-Fetching Library

**Objective:** To replace the basic `apiClient` with a more powerful data-fetching library like TanStack Query. This will provide a robust, declarative API for managing data fetching, caching, and synchronization, and will eliminate the need for manual loading and error state management.

**Status:** Not Started

**Dependencies:**
*   `introduce-a-centralized-state-management-solution.md`: The data fetching library will likely need to interact with the global state (e.g., for authentication tokens).

---

## Detailed Steps

### Step 1: Integrate TanStack Query

1.  **Add the dependency:**
    *   Run `npm install @tanstack/query-core` in the `webapp` directory.
2.  **Create a QueryClient instance:**
    *   In a new file, `webapp/src/js/query-client.ts`, create and export a singleton instance of the `QueryClient`.

        ```typescript
        // webapp/src/js/query-client.ts
        import { QueryClient } from '@tanstack/query-core';

        export const queryClient = new QueryClient();
        ```

### Step 2: Create a new `api.ts` Module

1.  **Create the file:** `webapp/src/js/api.ts`.
2.  **Purpose:** This module will define all the API queries and mutations for the application using TanStack Query.

### Step 3: Refactor Group List Fetching

**Target Files:**
*   `webapp/src/js/dashboard-init.ts`
*   `webapp/src/js/groups.ts`
*   `webapp/src/js/api-client.ts`

**Actions:**

1.  **Define a query for fetching groups in `api.ts`:**

    ```typescript
    // webapp/src/js/api.ts
    import { queryClient } from './query-client';
    import { apiClient } from './api-client';

    export const getGroupsQuery = () => ({
      queryKey: ['groups'],
      queryFn: () => apiClient.get('/groups'),
    });
    ```

2.  **Update `dashboard-init.ts` to use the new query:**
    *   Instead of manually fetching the data, use the `queryClient` to fetch and manage the groups data.

        ```typescript
        // webapp/src/js/dashboard-init.ts
        import { queryClient } from './query-client';
        import { getGroupsQuery } from './api';
        import { renderGroups, renderLoading, renderError } from './groups';

        // ... inside the main initialization logic
        const groupsQuery = getGroupsQuery();

        // Subscribe to the query
        queryClient.getQueryCache().subscribe((event) => {
          if (event.query.queryKey[0] === 'groups') {
            if (event.query.state.status === 'loading') {
              renderLoading();
            }
            if (event.query.state.status === 'success') {
              renderGroups(event.query.state.data);
            }
            if (event.query.state.status === 'error') {
              renderError(event.query.state.error);
            }
          }
        });

        // Fetch the data
        queryClient.fetchQuery(groupsQuery);
        ```

3.  **Simplify `groups.ts`:**
    *   The `groups.ts` module will now only be responsible for rendering the UI based on the data it receives. The logic for fetching, loading, and error handling will be removed.
    *   The `renderGroups`, `renderLoading`, and `renderError` functions will be called from `dashboard-init.ts`.

---

## Acceptance Criteria

*   TanStack Query is added as a dependency.
*   A `QueryClient` instance is created and exported.
*   The `api.ts` module is created and contains the `getGroupsQuery`.
*   The dashboard now uses TanStack Query to fetch and display the list of groups.
*   The `groups.ts` module is simplified to only handle rendering.
*   There is no functional or visual regression in how the groups are displayed on the dashboard.