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
