# Bug: 403 Forbidden when viewing pending group members

**Description:**

When a user who is not a group admin views the group settings, the application attempts to load the list of pending members. This API request fails with a `403 Forbidden` error, causing a poor user experience and preventing users with delegated permissions from managing group memberships.

**Steps to Reproduce:**

1. Log in as a user who is a member of a group but does not have the 'admin' role for that group. The group should be configured to allow non-admins to approve new members.
2. Navigate to the settings page for that group.
3. Observe the error message in the UI indicating that pending members could not be loaded.
4. Open the browser's developer console and observe a network error for the following request:
   `GET http://localhost:8005/api/groups/{groupId}/members/pending` with a status code of `403 (Forbidden)`.

**Expected Behavior:**

Users who have been granted permission to approve members (even if they are not group admins) should be able to view the list of pending members in the group settings. The API should return a `200 OK` and the list of pending members.

**Actual Behavior:**

The API returns a `403 Forbidden` error, and the user is shown an error in the UI. The list of pending members is not displayed.

**Root Cause Analysis:**

There is a discrepancy between the frontend authorization logic and the backend's enforcement policy.

1.  **Frontend:** The React component `webapp-v2/src/components/group/GroupSettingsModal.tsx` makes the API call to fetch pending members only if the `canApproveMembers` prop is `true`. This suggests the frontend has a more granular permission model where non-admins can be allowed to manage members.

2.  **Backend:** The API endpoint `GET /api/groups/{groupId}/members/pending` is defined in `firebase/functions/src/routes/route-config.ts` and its handler is `getPendingMembers` in `firebase/functions/src/groups/GroupSecurityHandlers.ts`. This handler is protected by the `validateAdminRequest` middleware, which calls `groupMemberService.ensureActiveGroupAdmin`. This backend service strictly requires the requesting user to have the 'admin' role within the group.

The `403 Forbidden` error occurs because the backend's `ensureActiveGroupAdmin` check is too restrictive and does not account for the more nuanced permissions model that the frontend seems to be using (`canApproveMembers`). The frontend allows the request, but the backend rejects it.

**Affected Files:**

*   `webapp-v2/src/components/group/GroupSettingsModal.tsx`: The frontend component making the request based on the `canApproveMembers` prop.
*   `firebase/functions/src/groups/GroupSecurityHandlers.ts`: Contains the backend API handler (`getPendingMembers`) and the restrictive `validateAdminRequest` middleware.
*   `firebase/functions/src/services/GroupMemberService.ts`: Contains the `ensureActiveGroupAdmin` function which enforces the admin-only policy.

**Recommendation:**

The authorization logic between the frontend and backend needs to be aligned. The recommended course of action is to update the backend to respect the more granular permissions model.

The `validateAdminRequest` middleware in `GroupSecurityHandlers.ts` should be replaced or modified. A new validation function should be created that checks if the user is either a group admin OR if the group's settings permit non-admins to approve members (which is likely the logic behind the frontend's `canApproveMembers` prop). This would bring the backend's authorization policy in line with the frontend's expectations.
