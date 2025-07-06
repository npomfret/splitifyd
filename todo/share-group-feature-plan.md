# Detailed Plan for "Share Group" Feature

## I. Backend (Firebase Functions - `firebase/functions/src/`)

### 1. Firestore Schema Update (Conceptual)

*   Groups are currently stored in the `documents` collection. The `data` field of a group document should contain a `members` array. Each member object in this array should include `uid` (Firebase User ID), `role` (e.g., 'admin', 'member'), and potentially `displayName` or `email`.
*   Add a new field to the group document: `shareableLink` (string, unique, indexed). This will store the unique ID for the shareable link.

### 2. New API Endpoint: `generateShareableLink` (HTTP Callable Function)

*   **Endpoint:** `POST /generateShareableLink`
*   **Authentication:** Requires authentication.
*   **Input:** `groupId` (string).
*   **Validation:**
    *   Validate `groupId` exists and is a valid group document.
    *   Verify the authenticated user is an 'admin' of the group (or at least a member with permission to generate links).
*   **Logic:**
    *   Generate a unique, short, and secure token (e.g., UUID or a short, random string).
    *   Store this token in the `shareableLink` field of the group document.
    *   Return the full shareable URL (e.g., `https://your-app.com/join-group?linkId=<token>`).
*   **Error Handling:** Handle cases where the group doesn't exist, the user isn't authorized, or link generation fails.

### 3. New API Endpoint: `joinGroupByLink` (HTTP Callable Function)

*   **Endpoint:** `POST /joinGroupByLink`
*   **Authentication:** Requires authentication.
*   **Input:** `linkId` (string).
*   **Validation:**
    *   Validate `linkId` exists and corresponds to an active group.
    *   Ensure the authenticated user is not already a member of the group.
*   **Logic:**
    *   Find the group document using the `linkId`.
    *   Add the authenticated user's `uid` and `displayName` (from `req.user`) to the `members` array of the group document with a default role (e.g., 'member').
    *   Return success message and potentially updated group details.
*   **Error Handling:** Handle cases where the link is invalid/expired, the user is already a member, or the update fails.

### 4. Modify `verifyGroupMembership` (in `expenses/handlers.ts` and potentially other group-related handlers)

*   Update this function to check if the `userId` is present in the `members` array of the group document, rather than checking `groupData.userId`. This is crucial for allowing non-owner members to interact with group expenses.

### 5. Firestore Security Rules (`firebase/firestore.rules`)

*   **Groups Collection:**
    *   Allow `read` access to a group document if `request.auth.uid` is present in the `resource.data.members` array.
    *   Allow `write` access to a group document if `request.auth.uid` is an 'admin' in the `resource.data.members` array.
    *   Allow `update` to the `members` array if `request.auth.uid` is an 'admin' or if the request is from the `joinGroupByLink` function (requires careful rule writing, possibly using a custom claim or a specific field update).
*   **Users Collection:** Ensure users can still only read/write their own user documents.

## II. Frontend (Webapp - `webapp/js/`)

### 1. UI for Sharing (in `group-detail-new.js` or a new component)

*   Add a "Share Group" button or option within the group settings/details page.
*   When clicked, trigger a call to the new `generateShareableLink` API endpoint.
*   Display the generated shareable link to the user (e.g., in a modal, with a copy-to-clipboard option).

### 2. Handle Incoming Shareable Links

*   Modify `app-init.js` or `auth-redirect.js` (or create a new `join-group.js`) to check for a `linkId` query parameter in the URL (e.g., `your-app.com/join-group?linkId=xyz`).
*   If a `linkId` is present:
    *   If the user is not authenticated, redirect them to the login/registration page, storing the `linkId` in local storage or a session variable. After successful login, redirect them back to the join group flow.
    *   If the user is authenticated, call the new `joinGroupByLink` API endpoint with the `linkId`.
    *   Display success/failure messages to the user.
    *   Upon successful joining, redirect the user to the group's detail page.

### 3. Update Group Member Display

*   Ensure the group detail page (`group-detail-new.js`) correctly displays all members from the `members` array, including newly joined members.

### 4. API Service Integration (`api.js`)

*   Add new functions to `api.js` to call the `generateShareableLink` and `joinGroupByLink` backend endpoints.

## III. Testing

### 1. Unit Tests (Firebase Functions)

*   Test `generateShareableLink` for valid/invalid group IDs, unauthorized access, and correct link generation.
*   Test `joinGroupByLink` for valid/invalid link IDs, users already in the group, and correct member addition.
*   Test `verifyGroupMembership` with various member roles and non-members.

### 2. Integration Tests (Firebase Functions)

*   Test the full flow: generate link -> user joins -> user can access group expenses.

### 3. Frontend Tests (if applicable)

*   Test UI elements for sharing.
*   Test redirection logic for incoming shareable links.

## IV. Considerations & Edge Cases

*   **Link Expiration/Revocation:** Should shareable links expire after a certain time or number of uses? Should group admins be able to revoke existing links? (Initial implementation can omit this, but it's a good future enhancement).
*   **User Experience:** Provide clear feedback to the user throughout the process (e.g., "Joining group...", "Group joined successfully!").
*   **Error Messages:** Provide user-friendly error messages for various failure scenarios.
*   **Security:**
    *   Ensure the generated `linkId` is sufficiently random and long to prevent brute-force attacks.
    *   Double-check Firestore rules to prevent unauthorized access or modification of group data.
    *   Consider rate-limiting on the `joinGroupByLink` endpoint to prevent abuse.
*   **Data Consistency:** Ensure that when a user joins a group, their user document is also updated (if necessary) to reflect their group memberships.
