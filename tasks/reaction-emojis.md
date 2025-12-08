
# Add Reaction Emojis to App Items

This task is to implement emoji reactions for various items within the application, such as expenses and comments. This will provide users with a quick and expressive way to engage with content.

## Initial Thoughts

-   Users should be able to add an emoji reaction to an item.
-   Users should be able to see who reacted with which emoji.
-   Users should be able to remove their own reaction.
-   The UI should display a summary of reactions (e.g., "👍 5", "❤️ 2").

## Research Needed

This feature requires some research before starting implementation to ensure a good user experience and a scalable backend design.

### Frontend (UI/UX)

1.  **Emoji Picker:**
    *   What is the best library to use for a modern emoji picker? (e.g., `emoji-picker-react`, `emojimart`)
    *   How should the picker be triggered? (e.g., a button, a hover-activated menu)
    *   Should there be a default set of "quick reactions" (like 👍, ❤️, 😂) and a full picker?

2.  **Displaying Reactions:**
    *   How should the aggregated reactions be displayed on an item?
    *   How should the list of users who reacted be displayed? (e.g., in a tooltip on hover, in a modal on click)

### Backend (Firebase/Firestore)

1.  **Data Modeling:**
    *   What is the most efficient way to store reactions in Firestore?
    *   **Option A: Subcollection on the parent document.**
        *   `expenses/{expenseId}/reactions/{userId}` -> `{ emoji: '👍', timestamp: ... }`
        *   **Pros:** Easy to query for who reacted.
        *   **Cons:** Might be more complex to get an aggregate count of each emoji. Could be more expensive for reads if we just need counts.
    *   **Option B: Map on the parent document.**
        *   `expenses/{expenseId}` -> `reactions: { '👍': ['userId1', 'userId2'], '❤️': ['userId3'] }`
        *   **Pros:** Easy to get aggregate counts. Fewer documents to read.
        *   **Cons:** The document could grow large if there are many reactions and many users. Firestore documents have a 1MB size limit.
    *   **Option C: A hybrid approach?**
        *   Store aggregate counts in the parent document and the detailed reactions in a subcollection. This would require using a Cloud Function to keep the aggregates in sync.

2.  **Security Rules:**
    *   How to structure security rules to allow users to add/remove their own reactions, but not others'?
    *   Ensure that only members of the group can react.

3.  **Real-time Updates:**
    *   How to handle real-time updates for reactions efficiently? When a user adds a reaction, other clients should see it appear without a full page reload. This should integrate with the existing activity feed system if possible, or use a direct Firestore listener.

## Task Breakdown (High-Level)

-   [ ] **Research:** Investigate UI libraries and backend data modeling options. Decide on the best approach.
-   [ ] **Backend:** Implement the chosen data model for reactions in Firestore.
-   [ ] **Backend:** Add security rules for reactions.
-   [ ] **Backend:** Create API endpoints or Cloud Functions (if needed) to manage reactions.
-   [ ] **Frontend:** Integrate an emoji picker component.
-   [ ] **Frontend:** Implement the UI for adding, viewing, and removing reactions.
-   [ ] **Frontend:** Connect the UI to the backend to send and receive reaction data in real-time.
-   [ ] **Testing:** Add tests for the new functionality.
