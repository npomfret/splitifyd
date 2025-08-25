# Feature: Group and Expense Comments

## Overview

To facilitate better communication and record-keeping, this feature introduces a real-time commenting system—similar to a mini chat—for both the main group page and individual expense pages. This allows users to discuss group matters or clarify details about specific transactions directly within the app.

## UI/UX Changes

### 1. Group-Level Comments

- A new "Comments" or "Discussion" tab/section will be added to the main group detail page.
- This area will display a chronological thread of messages related to the group in general.
- A text input field with a "Send" button will be persistently visible at the bottom of this section, allowing users to add new comments.

### 2. Expense-Level Comments

- A similar "Comments" section will be integrated into the expense detail view (either on the page or within the modal).
- This allows for focused conversations about a single transaction (e.g., "Is this the right receipt?", "I forgot to add the tip, can you update the total?").

### 3. Comment Interface

- The interface will resemble a modern, simple chat application.
- Each message will display the author's avatar, their display name, the comment text, and a relative timestamp (e.g., "just now", "2 minutes ago").
- The list of comments will be scrollable.

## Real-Time Functionality

- Comments must appear in real-time for all users currently viewing the group or expense. A manual page refresh should not be necessary to see new messages.
- This will be achieved by using Firestore's real-time listeners (`onSnapshot`) on the client-side.

## Backend & Data Model

New sub-collections will be added in Firestore to support this feature.

1.  **Group Comments Data Model:**
    - A `comments` sub-collection will be created under each `group` document (e.g., `/groups/{groupId}/comments`).
    - Each document in this sub-collection represents one comment.

2.  **Expense Comments Data Model:**
    - A `comments` sub-collection will be created under each `expense` document (e.g., `/groups/{groupId}/expenses/{expenseId}/comments`).

3.  **Comment Document Structure:**
    ```json
    {
        "authorId": "string", // UID of the user who wrote the comment
        "authorName": "string", // Display name of the author
        "text": "string", // The content of the comment
        "createdAt": "timestamp" // Server-side timestamp for ordering
    }
    ```

## API Requirements

- A new API endpoint (Firebase Function) will be required for **posting** new comments. This endpoint will handle validation (e.g., checking for empty messages, user permissions) and writing the new comment document to the appropriate sub-collection.
- **Fetching** comments will be handled client-side by listening directly to the relevant Firestore `comments` sub-collection in real-time.

## Future Enhancements

- **Notifications:** Implement push or in-app notifications when a user is mentioned in a comment (e.g., using `@username`).
- **Editing/Deleting Comments:** Add functionality for users to edit or delete their own comments.

---

# Implementation Progress

## ✅ Phase 1: Backend Implementation - COMPLETED

**Date Completed:** August 25, 2025

### Summary
Successfully implemented a complete backend infrastructure for the comments feature, including API endpoints, database structure, validation, security, and comprehensive testing.

### Files Created/Modified

#### New Files:
- `firebase/functions/src/comments/validation.ts` - Joi validation schemas with XSS protection
- `firebase/functions/src/comments/handlers.ts` - API handlers for create/list comments
- `firebase/functions/src/__tests__/unit/comments-validation.test.ts` - 29 comprehensive unit tests

#### Modified Files:
- `firebase/functions/src/shared/shared-types.ts` - Added comment types and interfaces
- `firebase/functions/src/index.ts` - Added comment API routes  
- `firebase/firestore.rules` - Added security rules for comment subcollections

### Technical Achievements

#### 🗄️ **Database & Types**
- Added `COMMENTS` collection to `FirestoreCollections`
- Created `Comment`, `CommentApiResponse`, `CreateCommentRequest` interfaces
- Defined `CommentTargetTypes` for 'group' and 'expense' comments
- Structured for subcollection pattern: `/groups/{id}/comments` and `/expenses/{id}/comments`

#### 🛡️ **Validation & Security**  
- Comprehensive Joi validation (1-500 character limit, XSS protection)
- Group membership verification for comment access
- Authentication required for all endpoints
- Input sanitization using existing `sanitizeString` utility

#### 🚀 **API Endpoints**
- `POST /groups/:groupId/comments` - Create group comment
- `GET /groups/:groupId/comments` - List group comments (paginated)
- `POST /expenses/:expenseId/comments` - Create expense comment  
- `GET /expenses/:expenseId/comments` - List expense comments (paginated)

#### ⚡ **Performance Features**
- Cursor-based pagination (20 comments per page, max 100)
- Efficient Firestore queries ordered by `createdAt DESC`
- Automatic user display name resolution from Firebase Auth
- Server-side timestamp generation for consistency

#### 🧪 **Testing**
- **29 unit tests** covering all validation scenarios
- Edge cases: empty text, oversized text, invalid target types
- XSS protection verification
- Query parameter validation
- Error handling and sanitization
- **All tests passing ✅**

### API Response Structure

**Create Comment Response:**
```json
{
  "success": true,
  "data": {
    "id": "comment123",
    "authorId": "user456", 
    "authorName": "John Doe",
    "authorAvatar": "https://...",
    "text": "This is a comment",
    "createdAt": "2025-08-25T18:30:00.000Z",
    "updatedAt": "2025-08-25T18:30:00.000Z"
  }
}
```

**List Comments Response:**
```json
{
  "success": true,
  "data": {
    "comments": [...],
    "hasMore": true,
    "nextCursor": "comment789"
  }
}
```

### Database Structure
```
/groups/{groupId}/comments/{commentId}
  - authorId: string
  - authorName: string  
  - authorAvatar?: string
  - text: string (1-500 chars)
  - createdAt: Timestamp
  - updatedAt: Timestamp

/expenses/{expenseId}/comments/{commentId}
  - (same structure)
```

### Next Steps
✅ Backend infrastructure complete and tested
🔄 **Ready for Phase 2: Frontend Implementation**

---

# Implementation Plan

## Architecture Analysis

Based on the existing codebase analysis, the comments feature will integrate seamlessly with the current architecture:

- **Backend**: Firebase Functions with Express.js routing (follows existing pattern)
- **Frontend**: Preact with Signals for state management (follows existing store patterns)
- **Real-time**: Firestore listeners with `onSnapshot()` (consistent with existing real-time features)
- **Validation**: Joi schemas on backend, Zod schemas on frontend (follows existing validation patterns)
- **Type Safety**: Shared types via `@shared` alias (consistent with existing type sharing)

## Phase 1: Backend Implementation

### 1.1 Data Model & Types

**File: `firebase/functions/src/shared/shared-types.ts`**
- Add comment-related interfaces:
```typescript
export interface Comment {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    text: string;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
}

export interface CreateCommentRequest {
    text: string;
    targetType: 'group' | 'expense';
    targetId: string;
    groupId?: string; // Required for expense comments
}

export interface ListCommentsResponse {
    comments: Comment[];
    hasMore: boolean;
    nextCursor?: string;
}
```

**File: `firebase/functions/src/shared/shared-types.ts` - Update collections**
```typescript
export const FirestoreCollections = {
    // ... existing
    COMMENTS: 'comments',
} as const;
```

### 1.2 Validation Layer

**File: `firebase/functions/src/comments/validation.ts` (NEW)**
- Joi validation schemas for comment creation
- Text sanitization and length validation (1-500 characters)
- XSS protection using existing `sanitizeString` utility
- Target validation (group/expense exists and user has access)

### 1.3 API Handlers

**File: `firebase/functions/src/comments/handlers.ts` (NEW)**
- `createComment`: POST endpoint for creating comments
- `listComments`: GET endpoint for fetching comment history (with pagination)
- Authentication middleware integration
- Permission validation (user must be group member)

### 1.4 API Routes

**File: `firebase/functions/src/index.ts` - Add routes**
```typescript
// Comments endpoints (requires auth)
app.post('/groups/:groupId/comments', authenticate, asyncHandler(createComment));
app.get('/groups/:groupId/comments', authenticate, asyncHandler(listComments));
app.post('/expenses/:expenseId/comments', authenticate, asyncHandler(createComment));
app.get('/expenses/:expenseId/comments', authenticate, asyncHandler(listComments));
```

### 1.5 Security Rules

**File: `firebase/firestore.rules` - Add comment rules**
```javascript
// Group comments subcollection
match /groups/{groupId}/comments/{commentId} {
  allow read: if request.auth != null; // Simplified for emulator
  allow write: if false; // Only via Functions
}

// Expense comments subcollection
match /expenses/{expenseId}/comments/{commentId} {
  allow read: if request.auth != null; // Simplified for emulator
  allow write: if false; // Only via Functions
}
```

### 1.6 Database Operations

**Firestore Structure:**
```
/groups/{groupId}/comments/{commentId}
/expenses/{expenseId}/comments/{commentId}
```

**Operations:**
- Create: Server-side timestamp generation
- Read: Query with pagination and ordering by `createdAt`
- No update/delete initially (future enhancement)

## Phase 2: Frontend Implementation

### 2.1 API Client Integration

**File: `webapp-v2/src/api/apiSchemas.ts`**
- Add Zod schemas for comment validation:
```typescript
export const CommentSchema = z.object({
    id: z.string(),
    authorId: z.string(),
    authorName: z.string(),
    authorAvatar: z.string().optional(),
    text: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const CreateCommentRequestSchema = z.object({
    text: z.string().min(1).max(500),
    targetType: z.enum(['group', 'expense']),
    targetId: z.string(),
    groupId: z.string().optional(),
});
```

**File: `webapp-v2/src/app/apiClient.ts`**
- Add comment-related API methods:
```typescript
async createComment(request: CreateCommentRequest): Promise<Comment>
async listComments(targetType: string, targetId: string, cursor?: string): Promise<ListCommentsResponse>
```

### 2.2 Comments Store

**File: `webapp-v2/src/app/stores/comments-store.ts` (NEW)**
```typescript
class CommentsStoreImpl {
    private commentsSignal = signal<Comment[]>([]);
    private loadingSignal = signal(false);
    private unsubscribe: (() => void) | null = null;

    // Real-time subscription to Firestore
    subscribeToComments(targetType: 'group' | 'expense', targetId: string, groupId?: string)
    
    // Add new comment
    async addComment(text: string, targetType: 'group' | 'expense', targetId: string, groupId?: string)
    
    // Cleanup
    dispose()
}
```

**Real-time Integration:**
- Use Firestore `onSnapshot()` for real-time updates
- Follow existing pattern from `group-detail-store-enhanced.ts`
- Automatic state updates when new comments arrive

### 2.3 UI Components

**File: `webapp-v2/src/components/comments/CommentsSection.tsx` (NEW)**
```typescript
interface CommentsSectionProps {
    targetType: 'group' | 'expense';
    targetId: string;
    groupId?: string;
    maxHeight?: string;
}
```

**File: `webapp-v2/src/components/comments/CommentItem.tsx` (NEW)**
- Individual comment display
- Avatar, name, timestamp, text
- Relative time formatting using existing `dateUtils.ts`

**File: `webapp-v2/src/components/comments/CommentInput.tsx` (NEW)**
- Text input with send button
- Character limit indicator (500 chars)
- Auto-resize textarea
- Loading state during submit

**File: `webapp-v2/src/components/comments/index.ts` (NEW)**
- Export all comment components

### 2.4 Page Integration

**File: `webapp-v2/src/pages/GroupDetailPage.tsx`**
- Add Comments section to right sidebar:
```typescript
<SidebarCard title="Comments">
    <CommentsSection 
        targetType="group" 
        targetId={groupId!} 
        maxHeight="400px" 
    />
</SidebarCard>
```

**File: `webapp-v2/src/pages/ExpenseDetailPage.tsx`**
- Add Comments section to expense detail view
- Integration with existing expense layout

### 2.5 Mobile Responsiveness

- Comments section collapses appropriately on mobile
- Touch-friendly input controls
- Optimized scrolling for comment history

## Phase 3: Testing & Quality Assurance

### 3.1 Backend Tests

**File: `firebase/functions/src/__tests__/integration/normal-flow/comments.test.ts` (NEW)**
- Create comment integration tests
- Permission validation tests
- Comment listing and pagination tests

**File: `firebase/functions/src/__tests__/unit/comments-validation.test.ts` (NEW)**
- Joi validation unit tests
- Text sanitization tests
- XSS protection tests

### 3.2 Frontend Tests

**File: `webapp-v2/src/__tests__/unit/components/comments/CommentsSection.test.tsx` (NEW)**
- Component rendering tests
- Real-time update tests
- User interaction tests

**File: `webapp-v2/src/__tests__/unit/stores/comments-store.test.ts` (NEW)**
- Store state management tests
- API integration tests
- Real-time subscription tests

### 3.3 E2E Tests

**File: `e2e-tests/src/tests/normal-flow/comments.test.ts` (NEW)**
- End-to-end comment creation flow
- Real-time update verification
- Multi-user comment scenarios

**Page Object Updates:**
- Add comment-related actions to `group-detail.page.ts`
- Add comment-related actions to `expense-detail.page.ts`

## Phase 4: Performance & Optimization

### 4.1 Real-time Optimization

- Implement comment pagination for large comment threads
- Efficient Firestore query ordering by `createdAt DESC`
- Connection management following existing patterns

### 4.2 UI Optimization

- Virtual scrolling for large comment lists
- Optimistic UI updates for better perceived performance
- Debounced input for auto-resize textarea

## Implementation Timeline

### Week 1: Backend Foundation ✅ **COMPLETED**
- [x] Data model and types definition
- [x] Validation layer implementation
- [x] API handlers and routing
- [x] Security rules update
- [x] Unit tests for backend

### Week 2: Frontend Foundation
- [ ] API client integration
- [ ] Comments store implementation
- [ ] Basic UI components
- [ ] Real-time subscription setup

### Week 3: UI Integration & Polish
- [ ] Page integration (Group & Expense)
- [ ] Mobile responsiveness
- [ ] UI polish and accessibility
- [ ] Frontend unit tests

### Week 4: Testing & Deployment
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance testing
- [ ] Production deployment

## Technical Considerations

### Security
- All comment text sanitized on server-side
- Permission validation ensures only group members can comment
- XSS protection using existing security utilities
- Rate limiting to prevent spam (future enhancement)

### Performance
- Pagination for comment history (20 comments per page)
- Efficient Firestore queries with proper indexing
- Real-time listeners optimized for minimal data transfer
- Connection pooling follows existing patterns

### Scalability
- Sub-collection structure scales well with document growth
- Firestore automatically handles indexing for timestamp queries
- Future horizontal scaling via comment archiving

### Consistency with Existing Patterns
- ✅ Joi validation on backend (matches expenses/groups)
- ✅ Zod validation on frontend (matches API schemas)
- ✅ Preact Signals for state (matches existing stores)
- ✅ Real-time listeners (matches existing real-time features)
- ✅ Express routing (matches existing API structure)
- ✅ Type sharing via `@shared` alias (matches existing types)

## Risk Mitigation

### Technical Risks
- **Real-time performance**: Implement pagination and connection limits
- **Comment spam**: Server-side rate limiting and text validation
- **Database costs**: Efficient queries and proper indexing

### User Experience Risks
- **Mobile usability**: Thorough responsive testing
- **Performance on slow connections**: Optimistic updates and loading states
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Success Metrics

### Technical Metrics
- Comment creation API latency < 200ms
- Real-time update propagation < 1 second
- Zero XSS vulnerabilities in security audit
- 100% test coverage for critical paths

### User Experience Metrics
- Comments load in < 500ms
- Mobile interface passes accessibility audit
- Real-time updates work reliably across all browsers
- Zero data loss during concurrent comment scenarios
