# Task: Implement Group Security Model

## Description

Currently, all groups operate in an "open" mode where all members have the same permissions. This task is to introduce a more structured security model with different roles and permissions to support more controlled environments.

## Requirements

### 1. Group Security Modes

Introduce two distinct security modes for groups:

-   **Open Mode (Default):** This is the current behavior. All members can add, edit, and delete any expense. All members can invite new users.
-   **Managed Mode:** A more restrictive mode where actions are controlled by designated "Admins".

### 2. Managed Mode Rules

When a group is in "Managed Mode":

-   **Roles:** Members can be either an "Admin" or a "Member".
-   **Permissions:**
    -   **Admins** can do everything a member can do, plus:
        -   Edit or delete any expense within the group.
        -   Approve or deny requests from new users to join the group.
        -   Promote other members to "Admin".
        -   Demote other "Admins" to "Member".
        -   Change the group's security mode.
    -   **Members** can:
        -   Add new expenses.
        -   Edit or delete *only the expenses they created*.
        -   View all group information.
-   **Admin Requirement:**
    -   A group in "Managed Mode" must have at least one Admin.
    -   If the last Admin leaves the group or is demoted, the group must automatically revert to "Open Mode" to prevent a locked state.

### 3. Join/Invite Flow for Managed Mode

The process for joining a "Managed" group via a share link will be different:

1.  A prospective user clicks the share link.
2.  Instead of being added immediately, they are placed in a "pending" or "awaiting approval" state.
3.  The UI should inform the user that an Admin needs to approve their request to join.
4.  Group Admins will receive a notification or see a list of pending members in the group management view.
5.  Admins can then approve or deny the join request.

### 4. Implementation Details

-   The user who creates the group will be the first Admin by default.
-   A new section in the group settings UI is needed to manage the security mode and member roles.
-   The backend needs to enforce these permissions on all relevant API endpoints (editing/deleting expenses, managing members).
