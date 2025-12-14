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

### Phase 3: Frontend (Current Focus)

#### 3.0 Backend Enhancement: Add userReactions to DTOs
- [ ] Add `userReactions?: ReactionEmoji[]` to ExpenseDTO, CommentDTO, SettlementDTO
- [ ] Modify FirestoreReader to fetch current user's reactions when loading resources
- [ ] Update unit tests to verify userReactions is returned

#### 3.1 Create ReactionPicker Component
**File**: `webapp-v2/src/components/reactions/ReactionPicker.tsx`

Portal-rendered emoji picker popover with 6 emoji options.

```typescript
interface ReactionPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (emoji: ReactionEmoji) => void;
    selectedEmojis: ReactionEmoji[];
    triggerRef: RefObject<HTMLElement>;
    disabled?: boolean;
}
```

**Implementation**:
- Use `createPortal()` to render to `document.body` (escape overflow containers)
- Position via `getBoundingClientRect()` on triggerRef with auto-flip
- Click-outside detection with capture phase listener
- Keyboard: Arrow keys navigate, Enter selects, Escape closes
- Focus management: focus first emoji on open, restore to trigger on close

**Styling** (semantic tokens):
- Container: `bg-surface-popover border-border-default rounded-lg shadow-lg z-50`
- Emoji button: `p-2 hover:bg-interactive-primary/10 rounded`
- Selected: `bg-interactive-primary/20 ring-1 ring-interactive-primary`

**Accessibility**:
- `role="listbox"` on container, `role="option"` on each emoji
- `aria-selected` for user's existing reactions
- `aria-label` on each: "Add thumbs up reaction"

- [ ] Create ReactionPicker component
- [ ] Add keyboard navigation
- [ ] Add accessibility attributes

#### 3.2 Create ReactionBar Component
**File**: `webapp-v2/src/components/reactions/ReactionBar.tsx`

Displays reaction pills (emoji + count) with add button.

```typescript
interface ReactionBarProps {
    counts: ReactionCounts;
    userReactions: ReactionEmoji[];
    onToggle: (emoji: ReactionEmoji) => void;
    disabled?: boolean;
    size?: 'sm' | 'md';
}
```

**Layout**: `[👍 2] [❤️ 1] [😂 3] [+]`
- Only show emojis with count > 0
- "+" button opens ReactionPicker
- User's reactions highlighted with different background

**Styling**:
- Pill: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm`
- Default: `bg-surface-muted hover:bg-surface-raised`
- User reacted: `bg-interactive-primary/20 text-interactive-primary`
- Size variants: `sm` (comments), `md` (expenses/settlements)

- [ ] Create ReactionBar component
- [ ] Add size variants
- [ ] Add loading state per emoji

#### 3.3 Integrate into CommentItem
**File**: `webapp-v2/src/components/comments/CommentItem.tsx`

**Placement**: Below comment bubble, above timestamp.

```
[Avatar] Author Name
        ┌─────────────────────┐
        │ Comment text here   │
        └─────────────────────┘
        <ReactionBar size="sm" ... />
        2 hours ago
```

**Changes**:
- Add `onReactionToggle?: (commentId, emoji) => void` prop
- Add ReactionBar below comment bubble
- Pass toggle handler from CommentsSection/CommentsList

- [ ] Add ReactionBar to CommentItem
- [ ] Update CommentsList to pass toggle handler
- [ ] Wire up API calls for group comments
- [ ] Wire up API calls for expense comments

#### 3.4 Integrate into ExpenseDetailModal
**File**: `webapp-v2/src/components/expense/ExpenseDetailModal.tsx`

**Placement**: After amount display, before key details grid.

```
$50.00
<ReactionBar size="md" ... />
[Date] [Labels] [Paid By]
```

- [ ] Add ReactionBar below amount
- [ ] Wire up toggleExpenseReaction API call

#### 3.5 Integrate into Settlement Components
**Files**: Find settlement display components (likely `SettlementItem.tsx`)

- [ ] Identify settlement components
- [ ] Add ReactionBar to settlement display
- [ ] Wire up toggleSettlementReaction API call

#### 3.6 Add i18n Keys
**File**: `webapp-v2/src/locales/en/translation.json`

```json
{
  "reactions": {
    "addReaction": "Add reaction",
    "removeReaction": "Remove reaction",
    "thumbsUp": "Thumbs up",
    "heart": "Heart",
    "laugh": "Laugh",
    "wow": "Wow",
    "sad": "Sad",
    "celebrate": "Celebrate"
  }
}
```

- [ ] Add i18n keys
- [ ] Update dynamic-translations.ts if using dynamic keys

#### 3.7 Playwright Tests
**File**: `webapp-v2/src/__tests__/integration/playwright/reactions.spec.ts`

**Test scenarios**:
1. Add reaction to comment (click "+", select emoji, verify appears)
2. Remove reaction (click existing reaction, verify count decreases)
3. Add reaction to expense
4. Multiple reactions (add 👍, add ❤️, remove 👍)
5. Keyboard navigation (Tab, Arrow keys, Enter, Escape)
6. Real-time sync (if multi-user tests exist)

- [ ] Create reactions.spec.ts
- [ ] Add ReactionPickerPage page object
- [ ] Add reaction methods to existing page objects

### Phase 4: Polish
- [ ] Optimistic UI updates (update count immediately, revert on error)
- [ ] Error toast on toggle failure
- [ ] Debounce rapid clicks
- [ ] Animation on reaction add/remove

---

## Research Findings (Phase 3 Preparation)

### Existing Patterns Discovered

**CommentItem Structure**:
- Flexbox row with avatar left, content right
- Comment bubble: `bg-surface-raised` (others) or `bg-interactive-primary` (current user)
- Uses `rounded-2xl` with sharp corner for chat bubble effect
- Already receives `comment: CommentDTO` with `reactionCounts`

**Popover/Dropdown Pattern**:
- Uses `createPortal()` from `preact/compat` (no external floating-ui library)
- Manual position calculation with `getBoundingClientRect()`
- Click-outside detection: capture phase listener with setTimeout guard
- Z-index: `z-50` for popovers
- Example files: `Tooltip.tsx`, `CurrencyAmountInput.tsx`, `UserMenu.tsx`

**Keyboard Navigation** (from `useDropdownSelector` hook):
- ArrowDown/ArrowUp: Navigate items
- Enter: Select highlighted item
- Escape: Close dropdown, restore focus to trigger
- Tab: Close dropdown

**State Management Pattern**:
- Private signals with `#` prefix for encapsulation
- Readonly getters for consumers
- Actions are the only mutation path
- Activity feed drives refresh (no manual `refreshAll()` calls)

**API Client**:
- Reaction toggle methods exist at lines 892-926
- Returns `ReactionToggleResponse` with action, emoji, newCount
- Activity feed events already trigger refresh

### Key Files Reference

| File | Relevance |
|------|-----------|
| `CommentItem.tsx` | Integration point for comment reactions |
| `ExpenseDetailModal.tsx` | Integration point for expense reactions |
| `Tooltip.tsx` | Pattern for portal positioning |
| `useDropdownSelector.ts` | Pattern for keyboard navigation |
| `comments-store.ts` | Pattern for signals-based state |
| `apiClient.ts:892-926` | Existing reaction toggle methods |

---

## Files to Create

### Backend (✅ Complete)
| File | Purpose | Status |
|------|---------|--------|
| `firebase/functions/src/schemas/reaction.ts` | Firestore schema | ✅ |
| `firebase/functions/src/reactions/ReactionHandlers.ts` | API handlers | ✅ |
| `firebase/functions/src/reactions/validation.ts` | Request validation | ✅ |
| `firebase/functions/src/services/ReactionService.ts` | Business logic | ✅ |
| `firebase/functions/src/__tests__/unit/api/reactions.test.ts` | Backend tests | ✅ |

### Frontend (Pending)
| File | Purpose | Status |
|------|---------|--------|
| `webapp-v2/src/components/reactions/ReactionPicker.tsx` | Emoji picker popover | ⏳ |
| `webapp-v2/src/components/reactions/ReactionBar.tsx` | Reaction display pills | ⏳ |
| `webapp-v2/src/components/reactions/index.ts` | Barrel export | ⏳ |
| `webapp-v2/src/__tests__/integration/playwright/reactions.spec.ts` | E2E tests | ⏳ |

## Files to Modify

### Backend (✅ Complete)
| File | Changes | Status |
|------|---------|--------|
| `packages/shared/src/shared-types.ts` | Add reaction types, extend DTOs | ✅ |
| `packages/shared/src/api.ts` | Add reaction API methods | ✅ |
| `packages/shared/src/schemas/apiSchemas.ts` | Add response schemas | ✅ |
| `firebase/functions/src/schemas/expense.ts` | Add reactionCounts field | ✅ |
| `firebase/functions/src/schemas/comment.ts` | Add reactionCounts field | ✅ |
| `firebase/functions/src/schemas/settlement.ts` | Add reactionCounts field | ✅ |
| `firebase/functions/src/routes/route-config.ts` | Add routes | ✅ |
| `firebase/functions/src/ApplicationFactory.ts` | Register handlers | ✅ |
| `firebase/firestore.rules` | Add reaction security rules | ✅ |
| `webapp-v2/src/app/apiClient.ts` | Add API methods | ✅ |

### Frontend (Pending)
| File | Changes | Status |
|------|---------|--------|
| `packages/shared/src/shared-types.ts` | Add `userReactions` to DTOs | ⏳ |
| `firebase/functions/src/services/firestore/FirestoreReader.ts` | Fetch user reactions | ⏳ |
| `webapp-v2/src/components/comments/CommentItem.tsx` | Add ReactionBar | ⏳ |
| `webapp-v2/src/components/comments/CommentsList.tsx` | Pass toggle handler | ⏳ |
| `webapp-v2/src/components/expense/ExpenseDetailModal.tsx` | Add ReactionBar | ⏳ |
| `webapp-v2/src/locales/en/translation.json` | Add i18n keys | ⏳ |

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
