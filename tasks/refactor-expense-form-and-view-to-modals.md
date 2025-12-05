# Refactor Expense Form and View to Modals

## Problem

The expense form and expense view currently exist as standalone pages. Most other similar interactive elements (settlements, group settings, sharing) are implemented as modals, leading to an inconsistent user experience and disrupting user flow by navigating away from the current context.

## Solution

Convert the expense form (add/edit/copy) and expense detail view from standalone pages into modal components, aligning with existing UI patterns (e.g., SettlementForm modal). Deep links will continue to work for both expenses and settlements by auto-opening modals when navigating to their URLs.

---

## Current State

### Expense Pages (to be converted)
- `webapp-v2/src/pages/AddExpensePage.tsx` - Full-page form handling add/edit/copy modes via query params
- `webapp-v2/src/pages/ExpenseDetailPage.tsx` - Full-page view with split breakdown, comments, receipt, actions

### Current Routes (to be preserved for deep linking)
- `/groups/:groupId/add-expense` - Add expense
- `/groups/:groupId/add-expense?id={id}&edit=true` - Edit expense
- `/groups/:groupId/add-expense?copy=true&sourceId={id}` - Copy expense
- `/groups/:groupId/expenses/:expenseId` - View expense details

### Reference Implementation
- `webapp-v2/src/components/settlements/SettlementForm.tsx` - Pattern to follow
- `webapp-v2/src/app/hooks/useGroupModals.ts` - Centralized modal state

---

## Implementation Plan

### Phase 1: Extend useGroupModals Hook

**File:** `webapp-v2/src/app/hooks/useGroupModals.ts`

Add expense modal state and actions:
```typescript
// New state signals
const showExpenseForm = useSignal(false);
const showExpenseDetail = useSignal(false);
const expenseFormMode = useSignal<'add' | 'edit' | 'copy'>('add');
const targetExpenseId = useSignal<ExpenseId | null>(null);

// New actions
const openExpenseForm = (mode: 'add' | 'edit' | 'copy', expenseId?: ExpenseId) => {
    expenseFormMode.value = mode;
    targetExpenseId.value = expenseId || null;
    showExpenseForm.value = true;
};
const closeExpenseForm = () => {
    showExpenseForm.value = false;
    targetExpenseId.value = null;
};
const openExpenseDetail = (expenseId: ExpenseId) => {
    targetExpenseId.value = expenseId;
    showExpenseDetail.value = true;
};
const closeExpenseDetail = () => {
    showExpenseDetail.value = false;
    targetExpenseId.value = null;
};
```

---

### Phase 2: Extend useFormSubmission for Modal Mode

**File:** `webapp-v2/src/app/hooks/useFormSubmission.ts`

Add optional callbacks for modal usage:
```typescript
interface UseFormSubmissionOptions {
    // ... existing
    onSuccess?: () => void;  // Called after successful save instead of navigation
    onCancel?: () => void;   // Called on cancel instead of navigation
}
```

Modify `handleSubmit` and `handleCancel`:
- If `onSuccess` provided, call it instead of `navigationService.goToGroup/goToExpenseDetail`
- If `onCancel` provided, call it instead of navigation
- Keep existing navigation as fallback for page-based usage

---

### Phase 3: Create ExpenseFormModal

**File to create:** `webapp-v2/src/components/expense-form/ExpenseFormModal.tsx`

**Props:**
```typescript
interface ExpenseFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: GroupId;
    mode: 'add' | 'edit' | 'copy';
    expenseId?: ExpenseId;  // Required for edit, source for copy
    onSuccess?: () => void;
}
```

**Structure (following SettlementForm pattern):**
1. Modal wrapper with size='lg' (expense form is complex)
2. Header with title based on mode + close button
3. Scrollable content area with max-h-[70vh]
4. Reuse existing form components via `useExpenseForm` hook with modal callbacks
5. Footer with Cancel/Submit buttons
6. Reset form state on open transition (like SettlementForm lines 103-159)

**Key implementation details:**
- Use `useState(() => signal(...))` pattern for component-local signals
- Track previous `isOpen` state with `useRef` to detect open transitions
- Pass `onSuccess` and `onCancel` callbacks to `useExpenseForm`
- Call `enhancedGroupDetailStore.refreshAll()` after successful mutation

---

### Phase 4: Create ExpenseDetailModal

**File to create:** `webapp-v2/src/components/expense/ExpenseDetailModal.tsx`

**Props:**
```typescript
interface ExpenseDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: GroupId;
    expenseId: ExpenseId;
    onEdit: (expenseId: ExpenseId) => void;   // Opens form modal in edit mode
    onCopy: (expenseId: ExpenseId) => void;   // Opens form modal in copy mode
}
```

**Structure:**
1. Modal wrapper with size='lg'
2. Header with expense description + close button
3. Scrollable content:
   - Expense summary (amount, payer, date, label)
   - SplitBreakdown component
   - CommentsSection component
   - Receipt viewer (if receipt exists)
4. Footer with action buttons (Edit, Copy, Delete, Share)
5. Load expense data on open via `apiClient.getExpenseFullDetails(expenseId)`

**Action handling:**
- Edit: `onClose()` then `onEdit(expenseId)`
- Copy: `onClose()` then `onCopy(expenseId)`
- Delete: Confirm, delete via API, `refreshAll()`, `onClose()`
- Share: Use existing share functionality

---

### Phase 5: Integrate Modals into GroupDetailPage

**File:** `webapp-v2/src/pages/GroupDetailPage.tsx`

**Changes:**
1. Import new modal components
2. Update handlers:
   ```typescript
   // Replace navigation with modal opens
   const handleExpenseClick = (expenseId: ExpenseId) => {
       modals.openExpenseDetail(expenseId);
   };
   const handleAddExpense = () => {
       modals.openExpenseForm('add');
   };
   ```
3. Wire up modal transitions (detail -> form for edit/copy):
   ```typescript
   const handleEditFromDetail = (expenseId: ExpenseId) => {
       modals.closeExpenseDetail();
       modals.openExpenseForm('edit', expenseId);
   };
   const handleCopyFromDetail = (expenseId: ExpenseId) => {
       modals.closeExpenseDetail();
       modals.openExpenseForm('copy', expenseId);
   };
   ```
4. Render modals at bottom of component (like SettlementForm)

---

### Phase 6: Implement Deep Link Detection

**File:** `webapp-v2/src/pages/GroupDetailPage.tsx`

Add useEffect to detect expense and settlement URLs and auto-open modals:
```typescript
useEffect(() => {
    if (!groupId || !isInitialized) return;

    const path = window.location.pathname;
    const search = new URLSearchParams(window.location.search);

    // Check for expense detail: /groups/:groupId/expenses/:expenseId
    const expenseDetailMatch = path.match(/\/groups\/[^/]+\/expenses\/([^/]+)/);
    if (expenseDetailMatch) {
        modals.openExpenseDetail(toExpenseId(expenseDetailMatch[1]));
        history.replaceState(null, '', `/groups/${groupId}`);
        return;
    }

    // Check for add/edit/copy expense: /groups/:groupId/add-expense
    if (path.includes('/add-expense')) {
        const id = search.get('id');
        const isEdit = search.get('edit') === 'true';
        const isCopy = search.get('copy') === 'true';
        const sourceId = search.get('sourceId');

        if (isEdit && id) {
            modals.openExpenseForm('edit', toExpenseId(id));
        } else if (isCopy && sourceId) {
            modals.openExpenseForm('copy', toExpenseId(sourceId));
        } else {
            modals.openExpenseForm('add');
        }
        history.replaceState(null, '', `/groups/${groupId}`);
        return;
    }

    // Check for settlement detail: /groups/:groupId/settlements/:settlementId
    const settlementDetailMatch = path.match(/\/groups\/[^/]+\/settlements\/([^/]+)/);
    if (settlementDetailMatch) {
        // TODO: Add settlement detail modal support if needed
        // For now, settlements use SettlementForm which handles edit
        history.replaceState(null, '', `/groups/${groupId}`);
        return;
    }
}, [groupId, isInitialized]);
```

---

### Phase 7: Update Routing

**File:** `webapp-v2/src/App.tsx`

Keep existing routes but point them to GroupDetailPage (which auto-opens modals):
- `/groups/:groupId/add-expense` -> `GroupDetailPage`
- `/groups/:groupId/expenses/:expenseId` -> `GroupDetailPage`

The deep link detection in Phase 6 handles opening the correct modal.

---

### Phase 8: Cleanup (After Testing)

**Files to deprecate/remove:**
- `webapp-v2/src/pages/AddExpensePage.tsx`
- `webapp-v2/src/pages/ExpenseDetailPage.tsx`

**Files to update:**
- `webapp-v2/src/services/navigation.service.ts` - Update or deprecate expense navigation methods
- Test files - Update page objects for modal-based interactions

---

## Critical Files

| File | Action |
|------|--------|
| `webapp-v2/src/app/hooks/useGroupModals.ts` | Extend with expense modal state |
| `webapp-v2/src/app/hooks/useFormSubmission.ts` | Add modal callbacks |
| `webapp-v2/src/components/expense-form/ExpenseFormModal.tsx` | Create new |
| `webapp-v2/src/components/expense/ExpenseDetailModal.tsx` | Create new |
| `webapp-v2/src/pages/GroupDetailPage.tsx` | Integrate modals + deep links |
| `webapp-v2/src/App.tsx` | Update route handling |
| `webapp-v2/src/components/settlements/SettlementForm.tsx` | Reference for patterns |

---

## Technical Decisions

1. **Modal size:** Use `lg` (max-w-2xl) for both modals - expense form is complex
2. **URL handling:** Use `history.replaceState()` to update URL without adding history entries
3. **Modal transitions:** Close detail modal before opening form modal (no nested modals)
4. **Form state:** Extend existing `useExpenseForm` hook rather than creating new one
5. **Data refresh:** Call `enhancedGroupDetailStore.refreshAll()` after mutations
6. **Deep links:** Support deep links for expenses and settlements by auto-opening modals

---

## Dependencies

- No backend changes required
- No new packages needed
- Reuses existing form and display components
- Follows established SettlementForm modal patterns
