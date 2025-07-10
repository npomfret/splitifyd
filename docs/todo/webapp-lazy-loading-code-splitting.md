# Webapp Issue: Lazy Loading and Code Splitting

## Issue Description

All JavaScript assets are loaded upfront, increasing the initial page load time.

## Recommendation

Refactor the application to use dynamic `import()` statements to load JavaScript modules on demand as they are needed for a specific page or component. Create page-specific entry points where each page has a minimal initialization script that dynamically loads only the necessary dependencies for that page.

## Implementation Suggestions

1.  **Identify Modules for Lazy Loading:**
    *   Modules that are only needed on specific pages (e.g., `add-expense.ts` is only needed on the add expense page).
    *   Modules that are large or contain complex logic that isn't immediately required on page load.

2.  **Use Dynamic `import()`:**
    *   Replace static `import` statements with dynamic `import()` where appropriate.
    *   **Example:** Instead of `import { GroupsList } from './groups.js';` at the top of `dashboard-init.ts` (or `dashboard.ts` after consolidation), you would load it dynamically.

    ```typescript
    // webapp/src/js/dashboard.ts (after consolidation)

    async function initializeDashboardPage(): Promise<void> {
        // ... (initial setup)

        // Dynamically import GroupsList when needed
        const { GroupsList } = await import('./groups.js');
        const groupsList = new GroupsList('groupsContainer');
        groupsList.loadGroups();

        // ...
    }
    ```

3.  **Create Page-Specific Entry Points:**
    *   Ensure each HTML page loads only a minimal JavaScript file that acts as its entry point.
    *   This entry point then dynamically imports other modules as needed.
    *   **Example:** `index.html` loads `auth-redirect.ts`, `dashboard.html` loads `dashboard.ts`, `add-expense.html` loads `add-expense.ts`, etc.

**Next Steps:**
1.  Audit all HTML files and their corresponding JavaScript entry points.
2.  Identify modules that can be loaded dynamically.
3.  Refactor `import` statements to use dynamic `import()` where appropriate.
4.  Measure page load times before and after implementing lazy loading to quantify the performance improvement.
