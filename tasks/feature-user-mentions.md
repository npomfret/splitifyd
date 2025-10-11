# Feature: User Mentions in Comments

## 1. Overview

This document outlines the implementation plan for a user mention system within the comments feature. This will allow users to directly notify other group members in comments by typing `@` followed by their name (e.g., `@Jane Doe`), triggering a specific notification for the mentioned user.

## 2. The Problem: Lack of Direct Notification

-   **Indirect Communication:** When a user wants to get another member's attention in a comment, there is no direct way to notify them. The other member would only see the comment if they happen to open the expense or group and read the comment thread.
-   **Missed Information:** Important questions or updates directed at a specific person can be easily missed, leading to communication delays.
-   **Standard Feature Expectation:** User mentions are a standard and highly expected feature in modern collaborative applications.

## 3. The Solution: An Integrated Mention System

The proposed solution is to implement an end-to-end mention system that includes:

1.  **Frontend UI:** An autocomplete dropdown in the comment input box that appears when a user types `@`.
2.  **Backend Logic:** A system to parse mentions from comment text, validate the mentioned users, and store the mention data.
3.  **Notification System:** A new, specific notification type to alert users when they have been mentioned.

### 3.1. High-Level Data Flow

1.  **Client-Side:** User types `@` in a comment box. An autocomplete list of group members appears. The user selects a member.
2.  **API Request:** The comment text, along with an array of `mentionedUserIds`, is sent to the backend.
3.  **Backend Service:** The `CommentService` validates that all mentioned users are part of the group.
4.  **Data Storage:** The comment is stored in Firestore with the `mentionedUserIds` array.
5.  **Notification Trigger:** A Firestore trigger on the `comments` collection detects the new comment and the `mentionedUserIds`.
6.  **Notification Creation:** The trigger creates a new, specific "mention" notification for each mentioned user.
7.  **Client-Side Notification:** The mentioned user receives a real-time notification and sees it in their notification panel.

---

## 4. Implementation Plan

### Phase 1: Backend Foundation

#### 4.1. Data Model Changes

**File:** `packages/shared/src/shared-types.ts`

Update the `CommentDTO` and `Comment` interfaces to include an array of mentioned user IDs.

```typescript
export interface Comment {
    // ... existing fields
    mentionedUserIds?: UserId[];
}

export interface CommentDTO extends Comment, BaseDTO {}
```

**File:** `firebase/functions/src/schemas/comment.ts`

Update the Zod schema for comment documents to include the new optional field.

```typescript
export const CommentDocumentSchema = z.object({
    // ... existing fields
    mentionedUserIds: z.array(z.string()).optional(),
});
```

#### 4.2. API and Service Layer

**File:** `firebase/functions/src/comments/validation.ts`

Update the `validateCreateComment` schema to accept the new `mentionedUserIds` field.

```typescript
export const validateCreateComment = (body: unknown): CreateCommentRequest => {
    const schema = Joi.object({
        // ... existing fields
        mentionedUserIds: Joi.array().items(Joi.string()).optional(),
    });
    // ...
};
```

**File:** `firebase/functions/src/services/CommentService.ts`

Modify the `createComment` method to handle mentions.

1.  Accept `mentionedUserIds` in the `commentData`.
2.  Before creating the comment, validate that all `mentionedUserIds` are actual members of the group. If not, throw an `ApiError`. This prevents invalid mentions.

```typescript
// In _createComment method
private async _createComment(
    // ... existing params
    commentData: CreateCommentRequest
): Promise<CommentDTO> {
    // ... existing logic

    // NEW: Validate mentioned users
    if (commentData.mentionedUserIds && commentData.mentionedUserIds.length > 0) {
        const groupMembers = await this.firestoreReader.getAllGroupMemberIds(groupId);
        for (const mentionedId of commentData.mentionedUserIds) {
            if (!groupMembers.includes(mentionedId)) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_MENTION', `User ${mentionedId} is not a member of this group.`);
            }
        }
    }

    const newComment: Comment = {
        // ... existing fields
        mentionedUserIds: commentData.mentionedUserIds || [],
    };

    // ... rest of the method
}
```

#### 4.3. Notification System

**File:** `firebase/functions/src/triggers/comment-tracker.ts`

Update the `onCommentChange` trigger to create mention notifications.

1.  When a new comment is created, check if the `mentionedUserIds` array exists and is not empty.
2.  For each `userId` in the `mentionedUserIds` array, create a new notification document in the `user-notifications` collection.
3.  This will be a new type of notification, e.g., `mention`. We can add a new field to the `user-notifications` document like `lastMentionAt` or a sub-collection for mentions. A sub-collection is more scalable.

```typescript
// In onCommentChange trigger
if (isNewComment) {
    const comment = change.after.data() as Comment;
    if (comment.mentionedUserIds && comment.mentionedUserIds.length > 0) {
        const mentionedUsers = comment.mentionedUserIds;
        // Logic to create a specific "mention" notification for each user in mentionedUsers.
        // This could involve a batch write to the user-notifications collection.
    }
}
```

### Phase 2: Frontend Implementation

#### 2.1. Autocomplete Component

**New File:** `webapp-v2/src/components/comments/MentionAutocomplete.tsx`

-   Create a new component that wraps the comment text area.
-   It will listen for the `@` character.
-   When `@` is typed, it will fetch the list of group members from the `group-detail-store` and display a dropdown list of members to mention.
-   When a user is selected, it will insert their name into the text area and store their `userId` in a local state array.

#### 2.2. Update Comment Form

**File:** `webapp-v2/src/components/comments/CommentForm.tsx`

-   Integrate the new `MentionAutocomplete` component.
-   When the form is submitted, the array of `mentionedUserIds` will be included in the payload sent to the `apiClient.createComment` method.

#### 2.3. Render Mentions

**File:** `webapp-v2/src/components/comments/CommentItem.tsx`

-   Create a utility function to parse the comment text and find mentions (e.g., `@[Display Name]`).
-   The `CommentItem` component will use this utility to render mentioned names with a distinct style (e.g., bold, highlighted background) to make them stand out.

#### 2.4. Update API Client

**File:** `webapp-v2/src/api/apiClient.ts`

Update the `createComment` method to include the optional `mentionedUserIds` array in the request body.

```typescript
async createComment(
    targetId: string,
    targetType: 'group' | 'expense',
    text: string,
    mentionedUserIds?: string[] // NEW
): Promise<any> {
    const payload = {
        targetId,
        targetType,
        text,
        mentionedUserIds, // NEW
    };
    // ...
}
```

---

## 5. Testing Plan

### 5.1. Unit Tests

-   **Backend:**
    -   Test the mention parsing logic to ensure it correctly extracts user IDs.
    -   Test the `CommentService` validation to ensure it rejects mentions of non-group members.
    -   Test the `onCommentChange` trigger to verify that it creates the correct notifications for mentioned users.
-   **Frontend:**
    -   Test the `MentionAutocomplete` component to ensure it appears at the right time and filters users correctly.
    -   Test the comment rendering utility to ensure it correctly identifies and styles mentions.

### 5.2. Integration Tests

-   Write an integration test that:
    1.  Creates a group with several members.
    2.  Creates a comment with mentions via the API.
    3.  Verifies that the `mentionedUserIds` are correctly stored in the comment document.
    4.  Uses the `NotificationDriver` to verify that the mentioned users receive a specific notification.

### 5.3. E2E Tests

-   Create a new E2E test file: `e2e-tests/src/tests/normal-flow/comment-mentions.e2e.test.ts`
-   **Test Scenario 1: Happy Path**
    1.  Log in as User A.
    2.  Create a group and invite User B.
    3.  Log in as User B and accept the invite.
    4.  As User A, navigate to an expense and start writing a comment.
    5.  Type `@` and verify that User B appears in the autocomplete list.
    6.  Select User B, finish the comment, and submit.
    7.  Log in as User B and verify that a "You were mentioned" notification is present.
-   **Test Scenario 2: Mentioning a non-member (UI should prevent this)**
    1.  The autocomplete should only show current group members, so it should not be possible to mention a non-member through the UI.

---

## 6. Rollout Strategy

This feature can be rolled out incrementally.

1.  **Backend First:** Deploy the backend changes (data model, service logic, triggers). The system will continue to function as normal, as the new fields are optional.
2.  **Frontend Implementation:** Deploy the frontend changes. Users will now be able to use the mention functionality.
3.  **Monitoring:** Monitor the performance of the `onCommentChange` trigger and the notification creation process to ensure it remains efficient.

This phased approach minimizes risk and allows for the backend infrastructure to be in place before the user-facing features are enabled.
