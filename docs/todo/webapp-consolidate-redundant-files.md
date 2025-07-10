# Webapp Issue: Consolidate Redundant Files

## Issue Description

There are overlapping files like `dashboard.js`/`dashboard-init.js` and `expense-detail.js`/`expense-detail-handlers.js`.

## Recommendation

Merge the functionality of these files and remove the redundant ones.

## Implementation Suggestions

1.  **Consolidate `dashboard.ts` and `dashboard-init.ts`:**
    *   The `dashboard-init.ts` file currently handles the initial authentication check and then initializes `GroupsList`. The `dashboard.ts` file is responsible for rendering the entire dashboard HTML structure.
    *   **Action:** Merge the initialization logic from `dashboard-init.ts` into `dashboard.ts`. The `dashboard.ts` file should become the single entry point for the dashboard page, handling authentication, rendering, and component initialization.
    *   **Result:** `dashboard-init.ts` can be removed.

2.  **Consolidate `expense-detail.ts` and `expense-detail-handlers.ts`:**
    *   `expense-detail.ts` loads and displays expense details, while `expense-detail-handlers.ts` sets up event listeners for back buttons, retry buttons, and delete modal close buttons.
    *   **Action:** Move all event listener setup from `expense-detail-handlers.ts` into `expense-detail.ts`'s `setupEventListeners` function or similar initialization logic.
    *   **Result:** `expense-detail-handlers.ts` can be removed.

**Next Steps:**
1.  Perform the consolidation for `dashboard.ts` and `dashboard-init.ts`.
2.  Perform the consolidation for `expense-detail.ts` and `expense-detail-handlers.ts`.
3.  Verify that all functionalities are preserved and no regressions are introduced.
4.  Delete the redundant files (`dashboard-init.ts`, `expense-detail-handlers.ts`).
