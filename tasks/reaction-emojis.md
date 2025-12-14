# Add Reaction Emojis to App Items

## Status: Backend Complete - Frontend Pending

## Overview

Implement Slack-style emoji reactions for expenses, comments (group and expense), and settlements. Users can add multiple reactions per item from a fixed set of 6 emojis. Reactions update in real-time via the existing activity feed system.

## Requirements (Confirmed)

- **Scope**: Expenses, group comments, expense comments, settlements
- **Reaction mode**: Multiple reactions per user (can add both 👍 AND ❤️ to same item)
- **Emoji set**: Quick reactions only - 👍 ❤️ 😂 😮 😢 🎉
- **Real-time**: Other users see reactions immediately

## Data Model: Hybrid Approach

Store both aggregate counts (for fast display) and individual reactions (for "who reacted" info).

### Storage Structure

```
expenses/{expenseId}/reactions/{userId}_{emoji}
groups/{groupId}/comments/{commentId}/reactions/{userId}_{emoji}
expenses/{expenseId}/comments/{commentId}/reactions/{userId}_{emoji}
settlements/{settlementId}/reactions/{userId}_{emoji}

# Aggregate counts on parent documents
expenses/{expenseId}.reactionCounts = { '👍': 3, '❤️': 1 }
```

**Document ID format**: `{userId}_{emoji}` - ensures uniqueness and enables simple toggle operations.

### New Types

```typescript
// Branded type
export type ReactionId = Brand<string, 'ReactionId'>;

// Fixed emoji set
export const ReactionEmojis = {
    THUMBS_UP: '👍', HEART: '❤️', LAUGH: '😂',
    WOW: '😮', SAD: '😢', CELEBRATE: '🎉',
} as const;
export type ReactionEmoji = (typeof ReactionEmojis)[keyof typeof ReactionEmojis];

// DTOs
export interface ReactionDTO {
    id: ReactionId;
    userId: UserId;
    emoji: ReactionEmoji;
    createdAt: ISOString;
}

export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;

export interface ReactionSummary {
    counts: ReactionCounts;
    userReactions: ReactionEmoji[];
}

export interface ReactionToggleResponse {
    action: 'added' | 'removed';
    emoji: ReactionEmoji;
    newCount: number;
}
```

### Extend Existing DTOs

Add optional `reactionCounts?: ReactionCounts` to:
- `ExpenseDTO`
- `CommentDTO`
- `SettlementDTO`

## API Design

### New Endpoints

```
POST /expenses/:expenseId/reactions          → toggleExpenseReaction
POST /groups/:groupId/comments/:commentId/reactions → toggleGroupCommentReaction
POST /expenses/:expenseId/comments/:commentId/reactions → toggleExpenseCommentReaction
POST /settlements/:settlementId/reactions    → toggleSettlementReaction
```

## Real-Time Updates

### Activity Feed Events

Add to `ActivityFeedEventTypes`:
- `REACTION_ADDED: 'reaction-added'`
- `REACTION_REMOVED: 'reaction-removed'`

### Flow

1. User toggles reaction → API call
2. Backend: Transaction updates subcollection + parent counts
3. Backend: Records activity feed event for group members
4. Frontend: Activity feed coordinator triggers `refreshAll()`
5. UI updates with new reaction counts

## Frontend Components

### ReactionPicker

Popover showing 6 emoji options.

### ReactionBar

Displays reaction pills (emoji + count). User's own reactions are highlighted.

### Integration Points

- `CommentItem.tsx` - Add ReactionBar below comment text
- `ExpenseDetailModal.tsx` - Add ReactionBar in expense detail
- Settlement components - Add ReactionBar

## Implementation Phases

### Phase 1: Backend Core ✅
- [x] Add types/DTOs to shared package
- [x] Create `firebase/functions/src/schemas/reaction.ts`
- [x] Create `firebase/functions/src/services/ReactionService.ts`
- [x] Create `firebase/functions/src/reactions/ReactionHandlers.ts`
- [x] Create `firebase/functions/src/reactions/validation.ts`
- [x] Add routes to `route-config.ts`
- [x] Update Firestore security rules
- [x] Register in ApplicationFactory and ComponentBuilder
- [x] Unit tests (16 tests passing)

### Phase 2: Backend Integration ✅
- [x] Update expense/comment/settlement schemas with `reactionCounts`
- [x] Extend activity feed with reaction events (types added)
- Note: FirestoreReader already includes reactionCounts in document reads

### Phase 3: Frontend
- [ ] Create ReactionPicker component
- [ ] Create ReactionBar component
- [ ] Integrate into CommentItem
- [ ] Integrate into ExpenseDetailModal
- [ ] Integrate into settlement components
- [ ] Add i18n keys
- [ ] Playwright tests

### Phase 4: Polish
- [ ] Optimistic UI updates
- [ ] Error handling
- [ ] Accessibility (keyboard nav, screen reader)

## Files to Create

| File | Purpose |
|------|---------|
| `firebase/functions/src/schemas/reaction.ts` | Firestore schema |
| `firebase/functions/src/reactions/ReactionHandlers.ts` | API handlers |
| `firebase/functions/src/reactions/validation.ts` | Request validation |
| `firebase/functions/src/services/ReactionService.ts` | Business logic |
| `firebase/functions/src/__tests__/unit/api/reactions.test.ts` | Backend tests |
| `webapp-v2/src/components/reactions/ReactionPicker.tsx` | Emoji picker |
| `webapp-v2/src/components/reactions/ReactionBar.tsx` | Reaction display |
| `webapp-v2/src/components/reactions/index.ts` | Barrel export |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/shared-types.ts` | Add reaction types, extend DTOs |
| `packages/shared/src/api.ts` | Add reaction API methods |
| `packages/shared/src/schemas/apiSchemas.ts` | Add response schemas |
| `firebase/functions/src/schemas/expense.ts` | Add reactionCounts field |
| `firebase/functions/src/schemas/comment.ts` | Add reactionCounts field |
| `firebase/functions/src/schemas/settlement.ts` | Add reactionCounts field |
| `firebase/functions/src/routes/route-config.ts` | Add routes |
| `firebase/functions/src/ApplicationFactory.ts` | Register handlers |
| `firebase/firestore.rules` | Add reaction security rules |
| `webapp-v2/src/app/apiClient.ts` | Add API methods |
| `webapp-v2/src/components/comments/CommentItem.tsx` | Add ReactionBar |
| `webapp-v2/src/components/expense/ExpenseDetailModal.tsx` | Add ReactionBar |
| `webapp-v2/src/locales/en/translation.json` | Add i18n keys |

## Security Rules

- Only group members can react to group resources
- Users can only add/remove their own reactions (enforced by document ID pattern)
- No updates allowed - reactions are add/remove only
- Settlement reactions restricted to payer/payee

## Complexity: Medium-High

- Touches multiple resource types (expenses, comments, settlements)
- Requires careful transaction handling for count consistency
- Real-time sync via existing activity feed
- Frontend components with accessibility considerations
