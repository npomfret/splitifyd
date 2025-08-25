# Feature: Group and Expense Comments - Frontend Implementation

## Backend Status: ✅ COMPLETE
**Phase 1 completed August 25, 2025** - Full backend infrastructure with comprehensive testing

## Phase 2: Frontend Implementation - TODO

### Overview
Implement the frontend UI and real-time functionality to consume the existing comments API. This includes creating React components, state management, real-time subscriptions, and integrating into existing pages.

---

## Task Breakdown

### 2.1 API Client Integration
**Priority: High | Estimated: 2-3 hours**

#### Files to Create/Modify:
- `webapp-v2/src/api/apiSchemas.ts` - Add Zod validation schemas
- `webapp-v2/src/app/apiClient.ts` - Add comment API methods

#### Implementation Details:
```typescript
// apiSchemas.ts additions
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
});

export const ListCommentsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    comments: z.array(CommentSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
  }),
});
```

```typescript
// apiClient.ts additions  
async createGroupComment(groupId: string, text: string): Promise<CommentApiResponse>
async createExpenseComment(expenseId: string, text: string): Promise<CommentApiResponse>  
async listGroupComments(groupId: string, cursor?: string, limit?: number): Promise<ListCommentsApiResponse>
async listExpenseComments(expenseId: string, cursor?: string, limit?: number): Promise<ListCommentsApiResponse>
```

#### Acceptance Criteria:
- [ ] Zod schemas match backend types exactly
- [ ] API methods handle authentication tokens  
- [ ] Error handling follows existing patterns
- [ ] Runtime validation on all responses

---

### 2.2 Comments Store Implementation  
**Priority: High | Estimated: 4-5 hours**

#### Files to Create:
- `webapp-v2/src/app/stores/comments-store.ts` - Main store implementation
- `webapp-v2/src/app/stores/index.ts` - Export new store

#### Implementation Details:
```typescript
interface CommentsStore {
  // State
  comments: CommentApiResponse[];
  loading: boolean;
  hasMore: boolean;
  nextCursor?: string;
  
  // Actions  
  subscribeToComments(targetType: 'group' | 'expense', targetId: string): void;
  addComment(text: string): Promise<void>;
  loadMoreComments(): Promise<void>;
  dispose(): void;
}
```

#### Key Features:
- **Real-time subscriptions** using Firestore `onSnapshot()`
- **Preact Signals** for reactive state management
- **Pagination support** with cursor-based loading
- **Optimistic updates** for better UX
- **Connection management** with proper cleanup

#### Acceptance Criteria:
- [ ] Real-time updates work across browser tabs
- [ ] Pagination loads correctly with "Load More" functionality
- [ ] Optimistic updates show immediately, rollback on error
- [ ] Memory leaks prevented with proper disposal
- [ ] Follows existing store patterns (auth-store, groups-store)

---

### 2.3 Core UI Components
**Priority: High | Estimated: 6-8 hours**

#### Files to Create:
- `webapp-v2/src/components/comments/CommentsSection.tsx` - Main container
- `webapp-v2/src/components/comments/CommentItem.tsx` - Individual comment  
- `webapp-v2/src/components/comments/CommentInput.tsx` - Text input with send
- `webapp-v2/src/components/comments/CommentsList.tsx` - Scrollable list
- `webapp-v2/src/components/comments/LoadMoreButton.tsx` - Pagination control
- `webapp-v2/src/components/comments/index.ts` - Component exports

#### Component Specifications:

**CommentsSection.tsx**
```typescript
interface CommentsSectionProps {
  targetType: 'group' | 'expense';
  targetId: string;
  maxHeight?: string;
  className?: string;
}
```
- Manages store subscription lifecycle
- Handles loading states
- Container for all comment functionality

**CommentItem.tsx**  
```typescript
interface CommentItemProps {
  comment: CommentApiResponse;
  showAvatar?: boolean;
}
```
- User avatar with fallback initials
- Relative timestamps (e.g., "2 minutes ago")
- Text with proper line breaks
- Author name styling

**CommentInput.tsx**
```typescript
interface CommentInputProps {
  onSubmit: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}
```
- Auto-resizing textarea
- Character counter (500 max)
- Send button with loading state
- Enter to send, Shift+Enter for new line
- Input validation and error display

#### Design Requirements:
- **Mobile-first responsive design**
- **Accessibility** - proper ARIA labels, keyboard navigation
- **Tailwind CSS** following existing design patterns
- **Loading states** for all async operations
- **Error handling** with user-friendly messages

#### Acceptance Criteria:
- [ ] Components render correctly on mobile and desktop
- [ ] Real-time updates appear immediately
- [ ] Character limit enforced with visual feedback
- [ ] Send button disabled during submission
- [ ] Proper loading and error states
- [ ] Accessibility requirements met (ARIA, keyboard nav)

---

### 2.4 Page Integration
**Priority: Medium | Estimated: 3-4 hours**

#### Files to Modify:
- `webapp-v2/src/pages/GroupDetailPage.tsx` - Add group comments
- `webapp-v2/src/pages/ExpenseDetailPage.tsx` - Add expense comments

#### Integration Approach:

**GroupDetailPage.tsx**
```typescript
// Add to right sidebar
<SidebarCard title="Comments" className="flex-1">
  <CommentsSection 
    targetType="group" 
    targetId={groupId!} 
    maxHeight="400px"
  />
</SidebarCard>
```

**ExpenseDetailPage.tsx**  
```typescript
// Add below expense details
<div className="mt-6">
  <h3 className="text-lg font-medium mb-3">Discussion</h3>
  <CommentsSection 
    targetType="expense" 
    targetId={expenseId!}
    maxHeight="300px"
  />
</div>
```

#### Acceptance Criteria:
- [ ] Comments integrate seamlessly with existing layouts
- [ ] No layout shifts when comments load
- [ ] Consistent styling with existing design system
- [ ] Mobile responsive integration

---

### 2.5 Real-time Infrastructure  
**Priority: High | Estimated: 2-3 hours**

#### Files to Create/Modify:
- `webapp-v2/src/utils/firestore.ts` - Firestore client setup (if not exists)
- Comments store real-time subscriptions

#### Implementation Details:
```typescript
// Real-time subscription pattern
const unsubscribe = onSnapshot(
  collection(db, `groups/${groupId}/comments`)
    .orderBy('createdAt', 'desc')
    .limit(20),
  (snapshot) => {
    const newComments = snapshot.docs.map(transformComment);
    commentsSignal.value = newComments;
  },
  (error) => {
    logger.error('Comments subscription error', error);
    // Handle connection errors gracefully  
  }
);
```

#### Key Requirements:
- **Connection resilience** - handle network drops
- **Error recovery** - retry failed connections  
- **Performance** - efficient query limits
- **Memory management** - proper unsubscribe cleanup

#### Acceptance Criteria:
- [ ] Comments appear in real-time across browser tabs
- [ ] Connection errors handled gracefully with retry
- [ ] No memory leaks from uncleaned subscriptions
- [ ] Works reliably on poor network connections

---

### 2.6 Testing Implementation
**Priority: Medium | Estimated: 4-5 hours**

#### Files to Create:
- `webapp-v2/src/__tests__/unit/stores/comments-store.test.ts` - Store tests
- `webapp-v2/src/__tests__/unit/components/comments/CommentsSection.test.tsx` - Component tests
- `webapp-v2/src/__tests__/unit/components/comments/CommentInput.test.tsx` - Input tests

#### Test Coverage Requirements:
```typescript
// Store tests
- ✅ Real-time subscription handling
- ✅ Optimistic updates and rollback
- ✅ Pagination with cursor management  
- ✅ Error handling and recovery
- ✅ Memory leak prevention

// Component tests  
- ✅ Rendering with mock data
- ✅ User interactions (typing, sending)
- ✅ Loading and error states
- ✅ Accessibility features
- ✅ Mobile responsive behavior
```

#### Acceptance Criteria:
- [ ] Store has 90%+ test coverage
- [ ] Components have comprehensive interaction tests
- [ ] Real-time functionality mocked and tested
- [ ] Error scenarios covered
- [ ] All tests pass in CI

---

### 2.7 Mobile Optimization
**Priority: Medium | Estimated: 2-3 hours**

#### Implementation Areas:
- **Touch-friendly interfaces** - larger tap targets
- **Keyboard handling** - mobile keyboard optimization
- **Scroll behavior** - smooth scrolling, proper viewport
- **Performance** - minimize re-renders on mobile
- **Offline resilience** - handle connection drops gracefully

#### Files to Optimize:
- All comment components for touch interfaces
- CSS media queries for mobile breakpoints
- Input handling for mobile keyboards

#### Acceptance Criteria:
- [ ] Comments section works smoothly on iOS Safari
- [ ] Android Chrome compatibility verified  
- [ ] Touch interactions feel responsive
- [ ] Mobile keyboard doesn't break layout
- [ ] Performance acceptable on slower devices

---

### 2.8 E2E Testing Integration
**Priority: Low | Estimated: 3-4 hours**

#### Files to Create/Modify:
- `e2e-tests/src/tests/normal-flow/comments.test.ts` - E2E comment flows
- `e2e-tests/src/support/page-objects/group-detail.page.ts` - Add comment actions
- `e2e-tests/src/support/page-objects/expense-detail.page.ts` - Add comment actions

#### Test Scenarios:
```typescript
// Multi-user real-time scenarios
test('comments appear in real-time for all group members', async ({ 
  authenticatedPage, 
  secondUser 
}) => {
  // User 1 adds comment
  // User 2 sees it immediately
  // Both users can reply
});

// Cross-page functionality  
test('expense comments visible from group and expense pages', async ({
  authenticatedPage
}) => {
  // Add comment on expense detail page  
  // Verify visible from group page
});
```

#### Acceptance Criteria:
- [ ] Real-time updates work in E2E environment
- [ ] Multi-user scenarios pass consistently  
- [ ] Comments persist across page refreshes
- [ ] All error states handled in E2E tests

---

## Implementation Timeline

### Week 1: Core Infrastructure (16-20 hours)
- **Day 1-2:** API Client Integration (2.1) + Comments Store (2.2)  
- **Day 3-5:** Core UI Components (2.3)

### Week 2: Integration & Polish (12-15 hours)  
- **Day 1-2:** Page Integration (2.4) + Real-time Infrastructure (2.5)
- **Day 3-4:** Testing Implementation (2.6)
- **Day 5:** Mobile Optimization (2.7)

### Week 3: Quality & Deployment (8-10 hours)
- **Day 1-2:** E2E Testing (2.8) 
- **Day 3:** Bug fixes and polish
- **Day 4-5:** Production deployment and monitoring

**Total Estimated Effort: 36-45 hours**

---

## Success Criteria

### Technical Requirements
- [ ] Real-time updates work reliably across all browsers
- [ ] Comments load in < 500ms on average connection
- [ ] Mobile interface passes accessibility audit (WCAG 2.1 AA)
- [ ] Zero memory leaks in real-time subscriptions
- [ ] All tests pass with >90% coverage

### User Experience Requirements  
- [ ] Intuitive chat-like interface
- [ ] Responsive design works on all screen sizes
- [ ] Loading states provide clear feedback
- [ ] Error messages are user-friendly and actionable
- [ ] Keyboard navigation fully functional

### Integration Requirements
- [ ] Seamless integration with existing group/expense pages
- [ ] Consistent with existing design system
- [ ] No breaking changes to existing functionality
- [ ] Backend API consumed correctly with all edge cases handled

---

## Risk Mitigation

### Technical Risks
- **Real-time performance degradation:** Implement pagination and connection limits
- **Memory leaks:** Comprehensive testing of subscription cleanup  
- **Mobile performance:** Profile and optimize re-renders

### UX Risks
- **Overwhelming interface:** Consider collapsible/tabbed design
- **Mobile keyboard issues:** Thorough testing on various devices
- **Network reliability:** Implement offline-friendly patterns

---

## Next Steps After Completion

### Future Enhancements (Phase 3)
- **@mention notifications** - Tag users in comments
- **Comment editing/deletion** - CRUD operations
- **Rich text formatting** - Bold, italic, links
- **File attachments** - Image/document sharing
- **Comment threading** - Replies to specific comments

### Monitoring & Analytics
- Track comment engagement metrics
- Monitor real-time performance
- A/B test different UI approaches
- Gather user feedback on UX improvements