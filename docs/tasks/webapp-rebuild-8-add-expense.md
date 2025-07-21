# Webapp Rebuild Task 8: Migrate Add Expense Page

## Overview
Migrate the add expense page with all splitting options (equal, exact amounts, percentages), member selection, and complex form validation to Preact.

## Prerequisites
- [ ] Complete webapp-rebuild-7-group-detail.md
- [ ] Group members available in state
- [ ] API client configured for expenses

## Current State
- Complex form with multiple splitting modes
- Manual calculation of splits
- Dynamic UI updates via DOM manipulation
- Extensive form validation logic
- No auto-save or draft functionality

## Target State
- Reactive form with real-time calculations
- Smooth UX for switching split modes
- Auto-save drafts functionality
- Enhanced validation and error handling
- Mobile-optimized input experience

## Implementation Steps

### Phase 1: Form Structure (2 hours)

1. **Add expense page** (`pages/AddExpensePage.tsx`)
   - [ ] Form layout with sections
   - [ ] Navigation header with save/cancel
   - [ ] Progressive form disclosure
   - [ ] Mobile-optimized layout

2. **Form components**
   ```
   components/expense/
   ├── ExpenseForm.tsx          # Main form wrapper
   ├── BasicDetailsSection.tsx  # Description, amount, date
   ├── PayerSection.tsx         # Who paid selection
   ├── SplitTypeSelector.tsx    # Equal/Exact/Percentage/Custom
   ├── SplitCalculator.tsx      # Split amount calculations
   ├── MemberSelector.tsx       # Choose participants
   ├── CategorySelector.tsx     # Expense categories
   └── ReceiptUpload.tsx        # Photo/receipt attachment
   ```

### Phase 2: Form State Management (2 hours)

1. **Expense form store** (`stores/expense-form-store.ts`)
   ```typescript
   interface ExpenseFormStore {
     description: string;
     amount: number;
     currency: string;
     date: Date;
     payer: string;
     splitType: 'equal' | 'exact' | 'percentage' | 'custom';
     participants: string[];
     splits: Record<string, number>;
     category: string;
     receipt?: File;
     
     updateField: (field: string, value: any) => void;
     calculateSplits: () => void;
     validateForm: () => boolean;
     saveExpense: () => Promise<void>;
     saveDraft: () => void;
     loadDraft: () => void;
   }
   ```

2. **Auto-save drafts**
   - [ ] Save to localStorage periodically
   - [ ] Restore on page load
   - [ ] Clear on successful save
   - [ ] Handle multiple group drafts

3. **Validation system**
   - [ ] Real-time field validation
   - [ ] Cross-field validation
   - [ ] Split amount validation
   - [ ] Required field checks
   - [ ] Custom validation rules

### Phase 3: Split Type Implementation (3 hours)

1. **Equal split** (simplest)
   - [ ] Divide amount equally among participants
   - [ ] Handle remainder distribution
   - [ ] Visual representation
   - [ ] Exclude/include payer option

2. **Exact amounts split**
   - [ ] Individual amount inputs for each participant
   - [ ] Running total calculation
   - [ ] Difference indicator
   - [ ] Auto-adjust last participant
   - [ ] Validation for total match

3. **Percentage split**
   - [ ] Percentage sliders/inputs
   - [ ] Running percentage total
   - [ ] Auto-calculate amounts
   - [ ] Handle 100% validation
   - [ ] Remainder handling

4. **Custom split modes**
   - [ ] Shares-based splitting
   - [ ] Mixed splitting (some equal, some exact)
   - [ ] Complex business rules
   - [ ] Custom formulas

### Phase 4: Member Selection & UI (1 hour)

1. **Member selection interface**
   - [ ] Checkbox list of group members
   - [ ] Select all/none shortcuts
   - [ ] Search/filter members
   - [ ] Visual member avatars
   - [ ] Participant count display

2. **Split visualization**
   - [ ] Visual split representation
   - [ ] Amount per person display
   - [ ] Color coding for amounts
   - [ ] Charts for complex splits
   - [ ] Summary calculations

### Phase 5: Advanced Features (2 hours)

1. **Category system**
   - [ ] Predefined categories
   - [ ] Custom category creation
   - [ ] Category icons/colors
   - [ ] Recent categories
   - [ ] Category suggestions

2. **Receipt handling**
   - [ ] Photo capture from camera
   - [ ] File upload from gallery
   - [ ] Image preview and editing
   - [ ] OCR text extraction (future)
   - [ ] Receipt storage and retrieval

3. **Enhanced input features**
   - [ ] Calculator for amounts
   - [ ] Currency conversion
   - [ ] Tax calculation helper
   - [ ] Tip calculation
   - [ ] Common amounts shortcuts

## In-Browser Testing Checklist

### Core Form Functionality

1. **Basic form operations**
   - [ ] All fields accept input
   - [ ] Form validation works
   - [ ] Save button enables/disables correctly
   - [ ] Cancel discards changes
   - [ ] Navigation warnings for unsaved changes

2. **Auto-save functionality**
   - [ ] Draft saved automatically
   - [ ] Draft restored on return
   - [ ] Multiple group drafts handled
   - [ ] Draft cleared after save

### Split Type Testing

1. **Equal split**
   - [ ] Amount divided correctly
   - [ ] Remainder distributed properly
   - [ ] Works with any number of participants
   - [ ] Payer inclusion/exclusion works

2. **Exact amounts split**
   - [ ] Individual inputs work
   - [ ] Total matches expense amount
   - [ ] Difference highlighted clearly
   - [ ] Auto-adjustment options work

3. **Percentage split**
   - [ ] Percentages calculate amounts correctly
   - [ ] Total percentage validation
   - [ ] Remainder handling correct
   - [ ] Slider interactions smooth

4. **Split type switching**
   - [ ] Smooth transition between modes
   - [ ] Data preserved where possible
   - [ ] UI updates correctly
   - [ ] No calculation errors

### Member Selection

1. **Participant management**
   - [ ] Select/deselect works
   - [ ] Select all/none works
   - [ ] Minimum participant validation
   - [ ] Payer always included
   - [ ] Visual feedback clear

2. **Split calculations with selections**
   - [ ] Calculations update with member changes
   - [ ] Removed members excluded from splits
   - [ ] Added members included correctly
   - [ ] Edge cases handled

### Validation Testing

1. **Form validation**
   - [ ] Required fields enforced
   - [ ] Amount validation (positive, reasonable)
   - [ ] Date validation (not future)
   - [ ] Description validation (length limits)

2. **Split validation**
   - [ ] Total split equals expense amount
   - [ ] No negative amounts
   - [ ] Percentage totals 100%
   - [ ] At least one participant

### Advanced Features

1. **Receipt upload**
   - [ ] Camera capture works
   - [ ] File upload works
   - [ ] Image preview correct
   - [ ] Upload progress shown
   - [ ] Error handling for large files

2. **Category system**
   - [ ] Category selection works
   - [ ] Custom categories created
   - [ ] Recent categories shown
   - [ ] Category icons display

### Mobile Experience

- [ ] Keyboard appropriate for number inputs
- [ ] Touch targets adequate size
- [ ] Scrolling smooth with keyboard
- [ ] Camera integration works
- [ ] Performance good on mobile

### Edge Cases

1. **Network issues**
   - [ ] Offline draft saving works
   - [ ] Sync when connection restored
   - [ ] Error handling for save failures
   - [ ] Retry mechanisms

2. **Data edge cases**
   - [ ] Very small amounts (cents)
   - [ ] Very large amounts
   - [ ] Many participants (20+)
   - [ ] Single participant
   - [ ] Fractional amounts

## Deliverables

1. **Complete add expense form**
2. **All split type implementations**
3. **Auto-save draft system**
4. **Receipt upload functionality**
5. **Mobile-optimized experience**

## Success Criteria

- [ ] All split types working correctly
- [ ] Calculations always accurate
- [ ] Form validation comprehensive
- [ ] Better UX than original
- [ ] Mobile experience excellent
- [ ] No data loss scenarios

## Complex Calculations Notes

1. **Floating point precision**
   - Use decimal library for monetary calculations
   - Round appropriately for display
   - Distribute remainders fairly
   - Handle multi-currency scenarios

2. **Split algorithms**
   - Equal: Simple division with remainder distribution
   - Exact: Validation and adjustment helpers
   - Percentage: Convert to amounts with precision
   - Custom: Flexible rule engine

3. **Performance optimization**
   - Debounce calculations on input
   - Memoize expensive calculations
   - Optimize re-renders
   - Lazy load complex features

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~10 hours

## Notes

- Most complex form in the app
- Calculation accuracy is critical
- Mobile UX especially important
- Consider user testing for split UX