# Feature: Invite Tracking

## Status: ✅ COMPLETED

## Overview

To better understand group growth and attribute new members to the person who invited them, this feature will associate share links with the user who created them. When a new user joins a group using a share link, the system will record who invited them.

## Key Concepts

- **Attribution:** When a user generates a share link, their user ID will be stored with the link's data.
- **Tracking:** When a new member joins a group via that link, the creator's user ID will be saved in the new member's group membership details as `invitedBy`.

## UI/UX Changes

- There are no direct UI changes for the user creating the link. This is primarily a backend and data model change.
- Future UI enhancements could display "Invited by [User Name]" in the members list.

## Backend & Data Model

### 1. Share Link Data Model ✅

The data model for share links has been implemented to include the creator's ID.

- **Location:** `groups/{groupId}/shareLinks/{shareLinkId}`
- **Implemented Structure:**
    ```typescript
    interface ShareLink {
        id: string;
        token: string; // The actual share token used in URLs
        createdBy: string; // UID of the user who created this share link
        createdAt: string; // ISO timestamp
        expiresAt?: string; // Future: expiration support (ISO timestamp)
        isActive: boolean; // For soft deletion/deactivation
    }
    ```

### 2. Group Member Data Model ✅

The data model for a user within a group's `members` list has been updated to store who invited them.

- **Location:** `groups/{groupId}`
- **Implemented `members` map:**
    ```typescript
    interface GroupMember {
        role: 'owner' | 'member';
        theme: UserThemeColor;
        joinedAt: string; // ISO timestamp
        invitedBy?: string; // UID of the user who created the share link
    }
    ```

## API Changes

### 1. Create Share Link Endpoint ✅

- **Endpoint:** `generateShareableLink` function in `shareHandlers.ts`
- **Implemented:** The endpoint automatically associates the authenticated user's ID as the `createdBy` field when creating ShareLink documents in the subcollection. No client-side change is needed.

### 2. Join Group via Link Endpoint ✅

- **Endpoint:** `joinGroupByLink` function in `shareHandlers.ts`
- **Implemented:**
    1.  When a user joins, the backend reads the `createdBy` field from the ShareLink document.
    2.  This `createdBy` user ID is saved as the `invitedBy` field in the new member's data within the group document.
    3.  All share links now use the new ShareLink subcollection format - no legacy support.

## Implementation Summary

This feature has been fully implemented with the following components:

### Files Modified:
- `firebase/functions/src/shared/shared-types.ts` - Added `ShareLink` interface and updated `GroupMember`
- `firebase/functions/src/groups/shareHandlers.ts` - Updated all share link functions to use subcollection format with invite tracking
- `firebase/firestore.rules` - Added security rules for `shareLinks` subcollection
- `firebase/functions/src/__tests__/integration/normal-flow/groups.test.ts` - Added comprehensive test suite for invite tracking

### Key Features:
- ✅ ShareLink documents stored in `groups/{groupId}/shareLinks/{shareLinkId}` subcollection
- ✅ `invitedBy` field automatically set when users join via share links
- ✅ Full test coverage with 4 test cases covering different scenarios
- ✅ Clean implementation with no backward compatibility code
- ✅ Proper error handling and validation
- ✅ Firestore security rules for subcollection access

## Future Enhancements

- **Analytics:** Track which users are the most effective at inviting new members.
- **Incentives:** Offer rewards or badges to users who successfully invite new members.
- **Social Features:** Display "Invited by [User Name]" in the group's member list to provide more social context.
