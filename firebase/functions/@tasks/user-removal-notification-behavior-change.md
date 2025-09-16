# User Removal Notification Behavior Change

## Overview

When a user is removed from a group, they no longer receive an explicit notification event. The `trackMembershipDeletion` trigger has been removed, and the group is atomically deleted from the user's notification document during the removal transaction.

## Previous Behavior

- User received a final notification when removed from a group
- `trackMembershipDeletion` trigger would send notification to the removed user
- This caused unnecessary notification events and potential confusion

## New Behavior

- User does NOT receive any notification event when removed from a group
- The group is atomically deleted from their `user-notifications` document
- The group simply disappears from their notification state

## Required UI Updates

### Group Page

When a user is viewing a group page and they are removed by another member:

- The user will NOT receive an explicit notification event
- The group will disappear from their `user-notifications` document
- The UI should detect this change (group no longer exists in their notifications)
- Recommended: Show a message like "You have been removed from this group" and redirect to dashboard

### Dashboard Page

When a user is on the dashboard and they are removed from a group:

- The group will disappear from their `user-notifications` document
- The UI should detect this change and refresh the dashboard
- The group should no longer appear in their group list

## Required E2E Test Updates

### Tests to Update

1. Any test that expects a notification when a user is removed from a group
2. Tests that verify user removal flow
3. Tests that check notification counts after member removal

### Key Changes

- Do NOT wait for removal notifications for the removed user
- Verify that the group disappears from the removed user's notification document
- Ensure UI properly handles the group disappearing without an explicit event

## Technical Details

### What Happens During Removal

1. `leaveGroupAtomic` method in FirestoreWriter:
    - Deletes membership document
    - Atomically deletes group from user's notification document
    - Increments changeVersion (but no group-specific counters)

2. `trackGroupChanges` trigger:
    - Notifies remaining members about the membership change
    - Does NOT notify the removed user

### Detection Strategy for UI

The UI can detect removal by:

1. Monitoring the `user-notifications` document
2. Detecting when a group disappears from the `groups` object
3. Comparing current groups with previously known groups
4. Taking appropriate action (redirect, refresh, etc.)

## Implementation Priority

1. Update UI to handle group disappearance gracefully
2. Update e2e tests to match new behavior
3. Ensure no test expects notifications for removed users
4. Add new tests to verify the atomic cleanup works correctly
