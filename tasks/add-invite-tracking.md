# Feature: Invite Tracking

## Overview

To better understand group growth and attribute new members to the person who invited them, this feature will associate share links with the user who created them. When a new user joins a group using a share link, the system will record who invited them.

## Key Concepts

-   **Attribution:** When a user generates a share link, their user ID will be stored with the link's data.
-   **Tracking:** When a new member joins a group via that link, the creator's user ID will be saved in the new member's group membership details as `invitedBy`.

## UI/UX Changes

-   There are no direct UI changes for the user creating the link. This is primarily a backend and data model change.
-   Future UI enhancements could display "Invited by [User Name]" in the members list.

## Backend & Data Model

### 1. Share Link Data Model

The data model for share links needs to be updated to include the creator's ID.

-   **Location:** `groups/{groupId}/shareLinks/{shareLinkId}` (or similar structure)
-   **New Structure:**
    ```json
    {
      "createdBy": "string", // UID of the user who created the link
      "createdAt": "timestamp",
      "expiresAt": "timestamp"
    }
    ```

### 2. Group Member Data Model

The data model for a user within a group's `members` list needs to be updated to store who invited them.

-   **Location:** `groups/{groupId}`
-   **New `members` sub-collection/map:**
    ```json
    "members": {
      "{userId}": {
        "role": "member",
        "joinedAt": "timestamp",
        "invitedBy": "string" // UID of the user who created the share link
      }
    }
    ```

## API Changes

### 1. Create Share Link Endpoint

-   **Endpoint:** (e.g., `POST /api/groups/{groupId}/share-link`)
-   **Change:** The endpoint will automatically associate the authenticated user's ID as the `createdBy` field when creating the new share link document. No client-side change is needed.

### 2. Join Group via Link Endpoint

-   **Endpoint:** (e.g., `POST /api/join-group/{shareLinkId}`)
-   **Change:**
    1.  When a user joins, the backend will read the `createdBy` field from the share link's data.
    2.  This `createdBy` user ID will be saved as the `invitedBy` field in the new member's data within the group document.
    3.  If the `createdBy` field does not exist on the share link (for legacy links), the `invitedBy` field can be omitted.

## Future Enhancements

-   **Analytics:** Track which users are the most effective at inviting new members.
-   **Incentives:** Offer rewards or badges to users who successfully invite new members.
-   **Social Features:** Display "Invited by [User Name]" in the group's member list to provide more social context.
