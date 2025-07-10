# Webapp Issue: Remove Unused Code and Features

## Issue Description

The codebase contains developer tools (`test-config.html`), incomplete features ("Settle Up", "Activity" tab), and unused backend code.

## Recommendation

Remove or move these to a separate `developer_tools` directory. Either complete or remove the underdeveloped UI features.

## Implementation Suggestions

1.  **Developer Tools (`test-config.html` and `test-config.ts`):**
    *   **Action:** Move `webapp/src/test-config.html` and `webapp/src/js/test-config.ts` to a new directory, e.g., `webapp/developer_tools/`.
    *   **Rationale:** These are useful for development but should not be part of the main application build or deployment. Moving them makes it clear they are not production features.

2.  **Incomplete Features:**
    *   **"Settle Up" button:**
        *   **Location:** `webapp/src/js/group-detail.ts`.
        *   **Current State:** The `settleUpBtn` has an event listener that calls `showMessage('Settlement feature coming soon!', 'info');`.
        *   **Action:** Decide whether to implement the feature or remove the button and associated logic. If removing, ensure the UI is updated accordingly.
    *   **"Activity" tab:**
        *   **Location:** `webapp/src/js/group-detail.ts`.
        *   **Current State:** The `loadGroupActivity()` function throws an error: `throw new Error('Activity timeline not implemented');`.
        *   **Action:** Decide whether to implement the feature or remove the tab and associated logic. If removing, ensure the UI is updated accordingly.

3.  **Unused Backend Code:**
    *   **Action:** This requires a review of the Firebase Functions codebase (`firebase/functions/src/`). Identify any functions or modules that are no longer called by the frontend or other backend services. If confirmed unused, remove them.
    *   **Reference:** The `docs/todo/unused-files-report.md` provides guidance on how to identify unused files, which can be applied to backend code as well.

**Next Steps:**
1.  Move `test-config.html` and `test-config.ts`.
2.  Make a decision on the "Settle Up" and "Activity" features: implement or remove.
3.  Conduct a review of backend code for unused parts.
