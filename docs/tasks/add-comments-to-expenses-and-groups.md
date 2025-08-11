# Feature: Group and Expense Comments

## Overview

To facilitate better communication and record-keeping, this feature introduces a real-time commenting system—similar to a mini chat—for both the main group page and individual expense pages. This allows users to discuss group matters or clarify details about specific transactions directly within the app.

## UI/UX Changes

### 1. Group-Level Comments

-   A new "Comments" or "Discussion" tab/section will be added to the main group detail page.
-   This area will display a chronological thread of messages related to the group in general.
-   A text input field with a "Send" button will be persistently visible at the bottom of this section, allowing users to add new comments.

### 2. Expense-Level Comments

-   A similar "Comments" section will be integrated into the expense detail view (either on the page or within the modal).
-   This allows for focused conversations about a single transaction (e.g., "Is this the right receipt?", "I forgot to add the tip, can you update the total?").

### 3. Comment Interface

-   The interface will resemble a modern, simple chat application.
-   Each message will display the author's avatar, their display name, the comment text, and a relative timestamp (e.g., "just now", "2 minutes ago").
-   The list of comments will be scrollable.

## Real-Time Functionality

-   Comments must appear in real-time for all users currently viewing the group or expense. A manual page refresh should not be necessary to see new messages.
-   This will be achieved by using Firestore's real-time listeners (`onSnapshot`) on the client-side.

## Backend & Data Model

New sub-collections will be added in Firestore to support this feature.

1.  **Group Comments Data Model:**
    -   A `comments` sub-collection will be created under each `group` document (e.g., `/groups/{groupId}/comments`).
    -   Each document in this sub-collection represents one comment.

2.  **Expense Comments Data Model:**
    -   A `comments` sub-collection will be created under each `expense` document (e.g., `/groups/{groupId}/expenses/{expenseId}/comments`).

3.  **Comment Document Structure:**
    ```json
    {
      "authorId": "string",      // UID of the user who wrote the comment
      "authorName": "string",    // Display name of the author
      "text": "string",         // The content of the comment
      "createdAt": "timestamp"  // Server-side timestamp for ordering
    }
    ```

## API Requirements

-   A new API endpoint (Firebase Function) will be required for **posting** new comments. This endpoint will handle validation (e.g., checking for empty messages, user permissions) and writing the new comment document to the appropriate sub-collection.
-   **Fetching** comments will be handled client-side by listening directly to the relevant Firestore `comments` sub-collection in real-time.

## Future Enhancements

-   **Notifications:** Implement push or in-app notifications when a user is mentioned in a comment (e.g., using `@username`).
-   **Editing/Deleting Comments:** Add functionality for users to edit or delete their own comments.
