# Simplify Cursor-Based Pagination in listDocuments

**Problem**: The `listDocuments` handler in `firebase/functions/src/documents/handlers.ts` currently uses a base64 encoded JSON string for cursor-based pagination. This approach adds unnecessary complexity and overhead for encoding and decoding the cursor on both the backend and frontend. It also makes debugging more difficult compared to using direct parameters.

**File**: `firebase/functions/src/documents/handlers.ts`

**Suggested Solution**:
1. **Use `updatedAt` and `id` Directly**: Instead of encoding a JSON object into a base64 string, pass the `updatedAt` timestamp and the `id` of the last document directly as separate query parameters (e.g., `lastUpdatedAt` and `lastId`). These fields are already used for ordering.
2. **Update Query**: Modify the Firestore query to use `startAfter(lastUpdatedAt, lastId)` directly. This is a cleaner and more explicit way to handle cursors.
3. **Update Frontend**: The frontend will need to be updated to send these two parameters instead of a single encoded cursor string. This will simplify the frontend's pagination logic as well.

**Behavior Change**: This is a behavior change. The API will now use simpler cursor parameters, which will require changes to the frontend to handle the new pagination logic. The functionality of pagination will remain the same, but the implementation details will differ.

**Risk**: Medium. This change requires coordinated modifications to both the backend and frontend. It's important to ensure that the pagination logic is implemented correctly on both sides to avoid any data inconsistencies or broken pagination.

**Complexity**: Medium. This change involves modifying the database query logic on the backend and updating the API request and response handling on the frontend.

**Benefit**: High. This change will simplify the pagination logic, reduce overhead (no more base64 encoding/decoding), make the API easier to use and debug, and improve overall code clarity.