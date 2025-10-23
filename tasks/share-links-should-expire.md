# Feature: Share Link Expiration

## Overview

This feature introduces an expiration mechanism for group share links to enhance security and control over group invitations. Users will be able to select how long a share link remains valid.

## User Interface (UI)

When a user generates a share link, a new UI element will be presented:

- A dropdown menu with the following options for link expiration:
    - 15 minutes
    - 1 hour
    - 1 day (Default)
    - 5 days

- The UI will be responsible for calculating the absolute expiration timestamp (e.g., `now() + selected_duration`) based on the user's selection.
- If the user changes the expiration period from the dropdown, a new share link with the new expiration time will be generated immediately.

## API Changes

The Firebase function responsible for creating share links will be updated to accept a new optional parameter.

- **Endpoint:** (e.g., `POST /api/groups/{groupId}/share-link`)
- **New Parameter:** `expiresAt` (timestamp)
    - This parameter will store the calculated future date and time when the link should expire.
    - If this parameter is omitted, the system can use the default expiration period (1 day).

## Backend Logic

When a user attempts to join a group using a share link, the following validation must occur:

1.  The system will retrieve the `expiresAt` timestamp associated with the share link from the database.
2.  It will compare the `expiresAt` timestamp with the current server time.
3.  **If `currentTime > expiresAt`:**
    - The link is considered expired.
    - The user will be denied access to the group.
    - The UI should display a clear error message to the user, such as "This invitation link has expired. Please request a new one from the group admin."
4.  **If `currentTime <= expiresAt`:**
    - The join process proceeds as normal.

## Implementation Plan

- **UI updates**
    - Extend the share link dialog in `webapp-v2` with a duration dropdown (15m, 1h, 1d default, 5d).
    - Compute `expiresAt` client-side as an ISO string/Firestore timestamp before invoking the share link creation API.
    - Trigger regeneration immediately when the selection changes so a fresh link (with new expiry) is shown.

- **API & types**
    - Update the TypeScript request contract for `createShareLink` to accept optional `expiresAt`.
    - Ensure server-side types (Firebase Functions request validator) treat `expiresAt` as optional but require a value ≥ now if provided.
    - Default missing `expiresAt` to `now + 1 day` in the function to maintain backwards compatibility with older clients.

- **Data model & storage**
    - Persist `expiresAt` alongside existing share link fields in Firestore (likely `groups/{groupId}/shareLinks/{shareLinkId}`).
    - Add `createdAt`/`updatedAt` timestamps as needed for auditing and to simplify future cleanup if not already present.

- **Creation workflow**
    - When creating a link, wrap writes in a transaction/batch: write the new link, then query and remove expired links for the same group (`expiresAt < now`).
    - The cleanup should run only in this creation path to satisfy "clean only when new ones are added".
    - Guard against concurrent creations by using batched deletes or retrying on contention.

- **Join validation**
    - Update the join-by-code/share link function to fetch the document and reject when `expiresAt` is missing or ≤ server `now`.
    - Return a specific error code consumed by the client to render the "invitation expired" message.

- **Testing**
    - Add unit tests for the creation function covering: default expiry, custom expiry, rejection of past timestamps, and cleanup of expired documents.
    - Extend integration/e2e coverage (in emulator suite) to verify join rejection after expiry and success before expiry.
