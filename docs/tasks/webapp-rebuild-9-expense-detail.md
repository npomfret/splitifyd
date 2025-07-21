# Webapp Rebuild Task 9: Migrate Expense Detail View

## Overview
Migrate the expense detail page with view/edit functionality, split breakdown, and expense management actions to Preact.

## Prerequisites
- [ ] Complete webapp-rebuild-8-add-expense.md
- [ ] Expense form components available
- [ ] API client configured for expense CRUD

## Current State
- Static expense display
- Modal or separate page for editing
- Basic expense information layout
- Manual navigation and updates

## Target State
- Dynamic expense detail with edit mode
- Smooth transitions between view/edit
- Real-time updates for changes
- Enhanced mobile experience
- Better visual split breakdown

## Implementation Steps

### Phase 1: Page Structure (1 hour)

1. **Expense detail component** (`pages/ExpenseDetailPage.tsx`)
   - [ ] Expense header with amount/description
   - [ ] Split breakdown section
   - [ ] Actions toolbar (edit/delete/share)
   - [ ] Comments/notes section
   - [ ] Receipt display

2. **View/edit modes**
   - [ ] Toggle between view and edit mode
   - [ ] Preserve form state during mode switch
   - [ ] Smooth transitions
   - [ ] Save/cancel actions

### Phase 2: Display Components (2 hours)

1. **Expense info components**
   ```
   components/expense-detail/
   ├── ExpenseHeader.tsx      # Amount, description, date
   ├── PayerInfo.tsx          # Who paid this expense
   ├── SplitBreakdown.tsx     # Visual split representation
   ├── ParticipantsList.tsx   # Who owes what
   ├── ReceiptViewer.tsx      # Receipt image display
   ├── ExpenseActions.tsx     # Edit/delete/share buttons
   └── ExpenseComments.tsx    # Comments and notes
   ```

2. **Split visualization**
   - [ ] Visual chart/graph of splits
   - [ ] Individual participant amounts
   - [ ] Percentage breakdowns
   - [ ] Color-coded amounts
   - [ ] Clear debt indicators

### Phase 3: Edit Mode Integration (2 hours)

1. **Edit mode implementation**
   - [ ] Reuse add expense form components
   - [ ] Pre-populate with existing data
   - [ ] Validation for updates
   - [ ] Handle split recalculations
   - [ ] Optimistic updates

2. **Edit mode features**
   - [ ] Inline editing for simple fields
   - [ ] Full form for complex changes
   - [ ] Preview changes before saving
   - [ ] Undo/redo functionality
   - [ ] Auto-save drafts

### Phase 4: Expense Actions (1 hour)

1. **Action implementations**
   - [ ] Edit expense (mode switch)
   - [ ] Delete expense (with confirmation)
   - [ ] Duplicate expense
   - [ ] Share expense details
   - [ ] Export expense

2. **Bulk operations** (if applicable)
   - [ ] Select multiple related expenses
   - [ ] Batch edit capabilities
   - [ ] Mass delete with confirmation
   - [ ] Export multiple expenses

### Phase 5: Receipt and Media (1 hour)

1. **Receipt display**
   - [ ] Full-screen image viewer
   - [ ] Zoom and pan functionality
   - [ ] Multiple image support
   - [ ] Image editing tools
   - [ ] Download original images

2. **Media management**
   - [ ] Add/remove receipts in edit mode
   - [ ] Replace existing receipts
   - [ ] Image optimization
   - [ ] Loading states for images
   - [ ] Error handling for failed uploads

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

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~7 hours

## Notes

- Reuse components from add expense task
- Focus on smooth edit mode experience
- Receipt viewer is important feature
- Consider accessibility for visual elements