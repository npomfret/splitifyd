# Webapp Rebuild Task 9: Migrate Expense Detail View

## Overview
Migrate the expense detail page with view/edit functionality, split breakdown, and expense management actions to Preact.

## Prerequisites
- [x] AddExpensePage completed with form components
- [x] Expense form store (expense-form-store.ts) available
- [x] API client configured for expense CRUD
- [x] ExpensesList component with onClick handler

## Current State
- ✅ ExpenseItem has onClick handler that passes expense data
- ✅ GroupDetailPage has handleExpenseClick that navigates to expense detail
- ✅ Expense detail route exists and works
- ✅ ExpenseDetailPage displays full expense information
- Edit functionality exists in AddExpensePage via URL params

## Target State
- Dynamic expense detail with edit mode
- Smooth transitions between view/edit
- Real-time updates for changes
- Enhanced mobile experience
- Better visual split breakdown

## Task Breakdown (4 commits, ~6 hours total)

### Commit 1: Basic Expense Detail View (1.5 hours) ✅ COMPLETED
- [x] Add expense detail route to App.tsx
- [x] Create ExpenseDetailPage component
- [x] Wire up navigation from ExpensesList
- [x] Display basic expense info (amount, description, date, category, payer)
- [x] Add loading and error states
- [x] Back navigation to group
- [x] Fix routing inconsistency (use /groups/ instead of /group/)
- [x] Implement split breakdown display with participants and amounts

### Commit 2: Split Breakdown Visualization (1.5 hours)
- [ ] Create SplitBreakdown component to replace basic split display
- [ ] Add visual progress bars showing percentage breakdown
- [ ] Color-coded debt indicators (red for owes, green for paid)
- [ ] Enhanced participant display with status icons
- [ ] Percentage display alongside amounts
- [ ] Improved mobile responsive layout
- [ ] Visual split type indicator (equal/exact/percentage)

### Commit 3: Edit Mode Integration (2 hours)
- [ ] Add edit/view mode toggle
- [ ] Reuse AddExpensePage form components
- [ ] Pre-populate form with existing data
- [ ] Save/cancel actions with validation
- [ ] Optimistic updates
- [ ] Smooth mode transitions

### Commit 4: Actions and Polish (1 hour)
- [ ] Delete expense with confirmation
- [ ] Share expense functionality
- [ ] Receipt viewer (if applicable)
- [ ] Error handling for all edge cases
- [ ] Performance optimizations
- [ ] Final testing and polish

## Implementation Details

### Key Components to Create

1. **ExpenseDetailPage.tsx** - Main page component ✅ COMPLETED
2. **Components for display:**
   - `SplitBreakdown.tsx` - Enhanced visual split representation (Phase 2)
   - `ExpenseActions.tsx` - Edit/delete/share buttons (Phase 4)

### Phase 2 Implementation Plan

**SplitBreakdown.tsx Component Structure:**
- Progress bar visualization for split percentages
- Participant cards with avatars, names, amounts, and percentages
- Color coding: green for payer, red for participants who owe
- Visual split type indicator badge
- Responsive grid layout for mobile
- Status icons (paid/owes) for clarity

**Current State Analysis:**
- Basic split display exists in ExpenseDetailPage lines 185-221
- Uses simple list format with avatars and amounts
- Missing visual hierarchy and percentage display
- No color coding or status indicators

**Enhancement Approach:**
- Extract current split display into dedicated SplitBreakdown component
- Add visual progress bars using CSS/Tailwind
- Implement participant status logic (payer vs participants)
- Add percentage calculations and display
- Enhance mobile responsiveness

**Implementation Steps:**
1. Create SplitBreakdown.tsx component with props interface
2. Move split display logic from ExpenseDetailPage (lines 192-213)
3. Add percentage calculations for each participant
4. Implement progress bar visualization with Tailwind
5. Add color coding based on participant status (payer vs owes)
6. Add split type badge indicator
7. Enhance mobile layout with responsive grid
8. Test with different split types and participant counts

### Reusable Components from AddExpensePage

- Form fields and validation logic
- Split type selection
- Participant selection
- Amount inputs
- Date picker

### API Integration

- GET `/expenses/:id` - Fetch single expense
- PUT `/expenses/:id` - Update expense
- DELETE `/expenses/:id` - Delete expense

### State Management

- Use expense-form-store.ts for edit mode
- Local state for view/edit toggle
- Optimistic updates for better UX

## In-Browser Testing Checklist

### Core Functionality

1. **Page loading**
   - [ ] Expense loads with correct data
   - [ ] All fields display properly
   - [ ] Split breakdown accurate
   - [ ] Actions available and working

2. **View mode**
   - [ ] All expense details visible
   - [ ] Split breakdown clear
   - [ ] Receipt images display
   - [ ] Navigation works properly

3. **Edit mode**
   - [ ] Smooth transition to edit
   - [ ] Form pre-populated correctly
   - [ ] All editing features work
   - [ ] Save/cancel functions properly

### Edit Functionality

1. **Field editing**
   - [ ] Description edits save
   - [ ] Amount changes recalculate splits
   - [ ] Date changes work
   - [ ] Category changes apply

2. **Split editing**
   - [ ] Can change split types
   - [ ] Participant changes work
   - [ ] Split amounts recalculate
   - [ ] Validation prevents errors

3. **Advanced edits**
   - [ ] Receipt upload/replacement
   - [ ] Category changes
   - [ ] Comments/notes edits
   - [ ] Payer changes work

### Actions Testing

1. **Delete expense**
   - [ ] Confirmation dialog shows
   - [ ] Expense deleted successfully
   - [ ] Navigation back to group
   - [ ] Group balances update

2. **Share expense**
   - [ ] Share URL works
   - [ ] Share content correct
   - [ ] Different share formats
   - [ ] Mobile sharing works

3. **Duplicate expense**
   - [ ] New expense form pre-filled
   - [ ] Can modify before saving
   - [ ] Original expense unchanged
   - [ ] Navigation to new expense

### Receipt Management

1. **Image display**
   - [ ] Images load correctly
   - [ ] Full-screen viewer works
   - [ ] Zoom/pan functions
   - [ ] Multiple images handled

2. **Image editing**
   - [ ] Can add new receipts
   - [ ] Can remove receipts
   - [ ] Can replace receipts
   - [ ] Upload progress shown

### Mobile Experience

- [ ] Touch-friendly interface
- [ ] Swipe gestures for navigation
- [ ] Mobile-optimized image viewer
- [ ] Good performance on mobile
- [ ] Responsive layout

### Error Scenarios

1. **Network issues**
   - [ ] Offline viewing works
   - [ ] Edit changes saved locally
   - [ ] Sync when reconnected
   - [ ] Conflict resolution

2. **Data issues**
   - [ ] Expense not found handled
   - [ ] Permission errors handled
   - [ ] Corrupted data handled
   - [ ] Invalid updates rejected

### Performance Testing

1. **Large receipts**
   - [ ] Large images load efficiently
   - [ ] Memory usage reasonable
   - [ ] Zoom performance good
   - [ ] Multiple images handled

2. **Complex splits**
   - [ ] Many participants render well
   - [ ] Split calculations fast
   - [ ] UI remains responsive
   - [ ] No render blocking

## Deliverables

1. **Complete expense detail page**
2. **Edit mode integration**
3. **Visual split breakdown**
4. **Receipt viewer and management**
5. **Expense action implementations**

## Success Criteria

- [ ] Full feature parity with original
- [ ] Smooth edit mode transitions
- [ ] Better visual split representation
- [ ] Enhanced mobile experience
- [ ] Reliable data consistency
- [ ] Good performance

## Implementation Notes

1. **State management**
   - Use existing expense form store
   - Handle optimistic updates carefully
   - Manage edit mode state properly
   - Cache expensive calculations

2. **Performance considerations**
   - Lazy load receipt images
   - Virtualize long participant lists
   - Debounce edit form updates
   - Optimize re-renders

3. **UX improvements**
   - Better visual hierarchy
   - Clearer split representation
   - Intuitive edit mode
   - Smooth transitions

## Phase 1 Completion Notes

**Completed:** January 30, 2025

**Implementation Details:**
- Created ExpenseDetailPage.tsx with full expense display functionality
- Added expense detail routes to App.tsx for both dev and production paths
- Fixed routing inconsistency (changed /group/ to /groups/ in GroupsList)
- Implemented expense data fetching with proper error handling and loading states
- Added back navigation and edit button
- Display includes: amount, description, date, category, payer info, and split breakdown
- Uses existing UI components (Card, Button, Avatar, Stack, LoadingSpinner)
- Follows established patterns for state management with signals
- Proper TypeScript typing throughout

**Files Modified:**
- webapp-v2/src/App.tsx - Added expense detail routes
- webapp-v2/src/components/dashboard/GroupsList.tsx - Fixed route consistency
- webapp-v2/src/pages/GroupDetailPage.tsx - Wired up expense click navigation
- webapp-v2/src/pages/ExpenseDetailPage.tsx - New component (235 lines)

**Next Steps:**
Ready for Phase 2: Split Breakdown Visualization (1.5 hours)

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~7 hours

## Notes

- Reuse components from add expense task
- Focus on smooth edit mode experience
- Receipt viewer is important feature
- Consider accessibility for visual elements