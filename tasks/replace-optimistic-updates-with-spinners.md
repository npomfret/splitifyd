# Task: Replace Optimistic Updates with Loading Spinners

## Overview

To improve the user experience and provide clearer feedback during data updates, all optimistic updates in the webapp will be replaced with loading spinners. This will ensure that the UI accurately reflects the state of the application and that users are aware when data is being saved.

## Problem Statement

Currently, the application uses optimistic updates in several places. This means that the UI is updated *before* the server has confirmed the change. While this can make the application feel faster, it can also lead to a confusing user experience if the server request fails and the UI has to be rolled back. It can also cause flaky E2E tests.

This task will involve identifying all instances of optimistic updates and replacing them with a more traditional loading pattern, where a spinner is displayed while the server request is in progress.

## Areas to be Refactored

The following is a comprehensive list of all the locations in the codebase where optimistic updates are currently implemented. Each of these areas needs to be refactored to use loading spinners instead.

### 1. Group Management (`webapp-v2/src/app/stores/groups-store-enhanced.ts`)

*   **`updateGroup` method:**
    *   **Current Behavior:** The `updateGroup` method immediately updates the local `groupsSignal` with the new group data before sending the request to the server.
    *   **Required Change:**
        1.  When `updateGroup` is called, a `loading` state should be set for the specific group being updated.
        2.  A loading spinner should be displayed in the UI for that group.
        3.  The API request should be sent to the server.
        4.  Once the server responds, the `loading` state should be cleared, and the UI should be updated with the new data from the server.
        5.  If the request fails, the `loading` state should be cleared, and an error message should be displayed.

*   **`createGroup` method:**
    *   **Current Behavior:** The `createGroup` method adds the new group to the local `groupsSignal` as soon as the API request returns, without re-fetching the full list of groups.
    *   **Required Change:**
        1.  When `createGroup` is called, a global `loading` state for the group list should be set.
        2.  A loading spinner should be displayed where the new group will appear.
        3.  The API request should be sent to the server.
        4.  After the server responds, the entire list of groups should be re-fetched to ensure the new group is included and the list is consistent with the server state.
        5.  The `loading` state should be cleared.

### 2. User Profile Updates (`webapp-v2/src/app/stores/auth-store.ts`)

*   **`updateUserProfile` method:**
    *   **Current Behavior:** The `updateUserProfile` method updates the local `userSignal` as soon as the API request returns, without waiting for the Firebase Auth user object to be reloaded.
    *   **Required Change:**
        1.  When `updateUserProfile` is called, a `loading` state should be set for the user profile section of the UI.
        2.  A loading spinner should be displayed.
        3.  The API request should be sent to the server.
        4.  After the server responds, the `userSignal` should be updated with the new data.
        5.  The `loading` state should be cleared.
        6.  The `currentUser.reload()` method should still be called to keep the Firebase Auth user object in sync.

## UI/UX Changes

*   **Group List:** When a group is being updated, a loading spinner should be displayed over the group's entry in the list.
*   **Group Creation:** When a new group is being created, a loading spinner or a placeholder element should be displayed in the group list.
*   **User Profile:** When the user's profile is being updated, a loading spinner should be displayed over the profile section or next to the "Save" button.

## Benefits

*   **Improved User Experience:** Users will have clear feedback that their changes are being saved.
*   **Reduced Confusion:** The UI will always accurately reflect the state of the application, preventing confusion if a server request fails.
*   **More Robust E2E Tests:** Eliminating optimistic updates will make the E2E tests more stable and reliable.
