# Task: Real-Time Dashboard Updates

## Overview

This task is to ensure that new groups and group changes appear automatically in the dashboard without the user needing to refresh the page. This will provide a more seamless and real-time experience for the user.

**Note:** This task is closely related to the "P1: Fix Real-Time UI Update Reliability" task outlined in `tasks/group-membership-lifecycle-analysis.md`.

## Problem Statement

Currently, the application has some real-time update functionality, but it is not working reliably. This is evident in the E2E tests, which still require manual `page.reload()` calls to ensure that changes are reflected in the UI. The goal of this task is to fix the existing implementation and make the real-time updates robust and reliable.

## Key Areas to Address

### 1. Real-Time Listeners

*   **Current State:** The application uses a `ChangeDetector` class with Firestore `onSnapshot` listeners to detect changes in the backend.
*   **Required Action:** Debug the existing `onSnapshot` listeners to understand why they are not consistently triggering UI updates. This may involve investigating Firestore security rules, query configurations, and the handling of snapshot data.

### 2. Race Conditions and Timing

*   **Current State:** The current implementation seems to have timing issues or race conditions that prevent the UI from updating correctly.
*   **Required Action:** Analyze the entire change detection and UI update process to identify and fix any race conditions. This may involve adding more robust state management, using versioning or timestamps to ensure data consistency, and implementing proper synchronization mechanisms.

### 3. E2E Tests

*   **Current State:** The E2E tests contain `page.reload()` calls as a workaround for the unreliable real-time updates.
*   **Required Action:** Once the real-time updates are working reliably, all `page.reload()` calls should be removed from the E2E tests. The tests should be updated to properly wait for and assert the expected real-time UI changes.

### 4. Error Handling

*   **Current State:** The error handling for connection issues and listener failures may not be sufficient.
*   **Required Action:** Improve the error handling for offline scenarios, poor network conditions, and cases where the Firestore listeners fail. The application should gracefully handle these situations and provide clear feedback to the user.

## Affected Areas

The following areas of the application will be affected by this task:

*   **Dashboard:** The main dashboard where the list of groups is displayed.
*   **Group Detail Page:** The page where the details of a specific group are displayed.
*   **State Management:** The `enhancedGroupsStore` and `enhancedGroupDetailStore` will need to be reviewed and potentially refactored.
*   **Backend:** The Firestore queries and security rules may need to be adjusted.
*   **E2E Tests:** The E2E tests will need to be updated to remove workarounds and properly test the real-time functionality.

## Acceptance Criteria

*   New groups appear in the dashboard in real-time without a page refresh.
*   Changes to existing groups (e.g., name, description) are reflected in the dashboard in real-time.
*   The E2E tests pass consistently without any `page.reload()` calls.
*   The application gracefully handles connection issues and provides appropriate feedback to the user.
