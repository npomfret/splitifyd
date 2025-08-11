# Feature: Replace Dashboard Statistics with Recent Activity

## Overview

To enhance user engagement and provide more dynamic, relevant information, the current "Statistics" section on the dashboard will be replaced with a "Recent Activity" feed. This feed will give users a real-time overview of important events across all their groups.

## UI/UX Changes

### 1. Removal of Statistics Section

-   The existing "Statistics" component and any associated data visualizations will be completely removed from the dashboard view.

### 2. Addition of Recent Activity Section

-   A new "Recent Activity" component will be added to the dashboard, likely in the same position as the old statistics section.
-   This component will display a chronological, scrollable list of recent events.

### 3. Activity Feed Item Design

Each item in the feed should be designed for clarity and quick scanning. It should include:

-   **Actor:** The user who performed the action (e.g., "Alice").
-   **Action:** A description of the event (e.g., "added a new expense", "joined the group").
-   **Object:** The item that was affected (e.g., "'Groceries'").
-   **Context:** The group where the event occurred (e.g., "in 'Weekend Trip'").
-   **Timestamp:** A relative time indicating when the event happened (e.g., "5 minutes ago", "yesterday").

### 4. Interaction

-   Clicking on an activity item will navigate the user directly to the relevant context. For example:
    -   Clicking on a "new expense" activity will navigate to that specific expense's detail page within the group.
    -   Clicking on a "user joined" activity will navigate to the group's main page.

## Types of Activities to Display

The feed should include, but is not limited to, the following events:

-   A user adds a new expense.
-   A user updates an existing expense.
-   A user joins a group.
-   A user leaves or is removed from a group.
-   A settlement or payment is recorded between members.
-   A new group is created.
-   A group's name or description is updated.

## Backend & API Requirements

-   A new Firestore-backed API endpoint will be required to fetch the recent activity feed for the currently authenticated user.
-   The endpoint must aggregate activities from all groups the user is a member of.
-   It must support pagination (e.g., fetching the last 20 items, with the ability to load more).
-   The implementation should be optimized for performance, possibly by creating a top-level `user_activity` collection that duplicates key events, indexed by user ID and timestamp, to avoid complex, slow cross-collection queries.
