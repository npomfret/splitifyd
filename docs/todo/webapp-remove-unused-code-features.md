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

## Implementation Progress

**✅ COMPLETED - 2025-07-11**

### Changes Made:
1. **Developer Tools Moved:**
   - Moved `test-config.html`, `test-config.ts`, and `test-config.css` from `webapp/src/` to `webapp/developer_tools/`
   - Updated file paths in `test-config.html` to reference the new location
   - These files are now excluded from the production build automatically

2. **"Settle Up" Button Removed:**
   - Removed the "Settle Up" button from `webapp/src/group-detail.html`
   - Removed associated JavaScript event listener and handler from `webapp/src/js/group-detail.ts`
   - Decision: Removed due to lack of backend implementation - would require significant backend work

3. **"Activity" Tab Removed:**
   - Removed the "Activity" tab from `webapp/src/group-detail.html`
   - Removed associated HTML content and JavaScript handlers from `webapp/src/js/group-detail.ts`
   - Decision: Removed due to lack of backend implementation - would require significant backend work

4. **Backend Code Review:**
   - Reviewed all backend endpoints in `firebase/functions/src/index.ts`
   - Cross-referenced with frontend API calls in `webapp/src/js/api.ts`
   - All backend endpoints are being used by the frontend
   - No unused backend code found

### Files Modified:
- `/webapp/src/group-detail.html` - Removed "Settle Up" button and "Activity" tab
- `/webapp/src/js/group-detail.ts` - Removed associated JavaScript handlers
- `/webapp/developer_tools/test-config.html` - Updated file paths
- `/webapp/developer_tools/test-config.ts` - Moved from src
- `/webapp/developer_tools/test-config.css` - Moved from src

### Testing:
- Build completes successfully
- All tests pass (34/34)
- No TypeScript errors
- Developer tools still functional in new location

**Status: COMPLETE** ✅
