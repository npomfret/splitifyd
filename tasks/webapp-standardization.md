# Webapp Standardization

## Status: Phase 3 Complete, Phase 4 Planned

Phase 1 complete: Layout components, hooks, and utilities created.
Phase 2 complete: Modal/List migrations and additional UI components.
Phase 3 complete: New standardization hooks (useLocalSignal, useClickOutside, useAsyncAction).
Phase 4 planned: Additional standardization based on codebase research.

---

## Phase 4: Research Findings & Proposed Work

### Priority 1: HIGH IMPACT

#### 1.1 Global Toast/Notification System

**Problem:** No centralized notification system. Each component manages its own success/error messages with inconsistent approaches.

**Current inconsistencies:**
- `useSuccessMessage` hook exists but is component-local
- Some use `useState` for messages, others use signals
- Timeout values vary: 1000ms, 4000ms, 5000ms, configurable
- No queue management for multiple notifications
- Success feedback sometimes silent, sometimes shown

**Examples of fragmentation:**
- `UserEditorModal.tsx`: Direct `setSuccessMessage`/`setErrorMessage` state
- `TenantEditorModal.tsx`: Same pattern, different timeouts
- `AdminTenantConfigTab.tsx`: `setTimeout(() => setActionMessage(null), 4000)`
- `ShareGroupModal.tsx`: Signal-based error/loading states

**Proposed solution:** Create `notificationStore` with:
- Centralized toast queue management
- Standardized variants: success, error, warning, info
- Configurable auto-dismiss with sensible defaults
- Optional action buttons
- Accessibility (aria-live regions)

---

#### 1.2 Form Validation Hook

**Problem:** Validation approaches are highly inconsistent across components.

**Current inconsistencies:**
- Some use inline validation functions, others use imported validators
- Mix of `useState` and signals for error state
- Some validate on submit, others on change, others on blur
- Error handling spreads across multiple error states vs. single
- No schema reuse between client and server

**Examples of fragmentation:**
- `CreateGroupModal.tsx`: Manual inline validation function
- `CommentInput.tsx`: Character limit validation inline
- `SettlementForm.tsx`: Multiple signal-based error states
- `TenantEditorModal.tsx`: Imported validator function

**Proposed solution:** Create `useFormValidation()` hook:
- Schema-based validation (reuse Zod schemas from shared)
- Unified error state management
- Field-level and form-level errors
- Support for real-time (onChange) and deferred (onSubmit) validation
- Integration with `useAsyncAction` for submission

---

#### 1.3 ListStateRenderer Adoption

**Problem:** Component exists but is underutilized. Many components manually implement loading/error/empty state logic.

**Current usage:** Only 3 files (ExpensesList, CommentsList, GroupsList)

**Not using ListStateRenderer:**
- `SettlementHistory.tsx` - Manual conditionals
- `ActivityFeedDropdownContent.tsx` - Inline ternaries
- `GroupActivityFeed.tsx` - Manual state rendering
- `AdminUsersTab.tsx` - Partial implementation

**Proposed work:** Migrate remaining list components to use ListStateRenderer.

---

#### 1.4 ErrorState Adoption

**Problem:** ErrorState component exists but is severely underutilized (~75% of error displays are manual).

**Current inconsistencies:**
- Some use `ErrorState` component
- Some use `Alert` component for errors
- Some use manual divs with custom styling
- Retry button rendering varies (raw buttons vs Button component)

**Examples of manual error handling:**
- `GroupActivityFeed.tsx`: Manual div with retry button
- `ActivityFeedDropdownContent.tsx`: Manual div with Button
- `ExpenseActions.tsx`: Inline Alert component

**Proposed work:** Standardize on ErrorState or Alert with clear guidelines for when to use each.

---

### Priority 2: MEDIUM IMPACT

#### 2.1 Keyboard Event Utilities

**Problem:** Keyboard handling is scattered and duplicated across components.

**Current inconsistencies:**
- Escape key handling duplicated in Modal, ConfirmDialog, dropdowns
- Enter-to-submit varies (some check shiftKey, others don't)
- Arrow key navigation only in useDropdownSelector
- No standardized accessibility patterns

**Examples:**
- `Modal.tsx`: Document-level escape key listener
- `CommentInput.tsx`: Enter with shift modifier support
- `ConfirmDialog.tsx`: Escape with loading state guard
- `useDropdownSelector.ts`: Comprehensive arrow/enter/escape/tab

**Proposed hooks:**
- `useEscapeKey(callback, options)` - Modal/dropdown escape handling
- `useEnterSubmit(callback, options)` - Form submission with shift support
- `useArrowNavigation(options)` - List/menu keyboard navigation

---

#### 2.2 Load More Component

**Problem:** Two pagination patterns coexist without clear guidelines.

**Current patterns:**
- `Pagination` component: Bidirectional navigation (Groups, Admin)
- Custom "Load More" buttons: Append-style (Expenses, Comments, Settlements, Activity)

**Inconsistencies in Load More:**
- Different styling: full-width vs centered, ghost vs secondary variant
- Different loading states: text change vs spinner
- Some use Button component, others raw buttons

**Proposed work:** Create `LoadMoreButton` component or document clear pattern for append-style pagination.

---

#### 2.3 Error Boundary Granularity

**Problem:** Only app-level ErrorBoundary exists. One component crash takes down entire app.

**Current state:**
- Single ErrorBoundary wraps entire App in App.tsx
- No section-level error boundaries
- No error recovery per feature area

**Proposed work:** Add ErrorBoundary wrappers around:
- Modal contents
- Form sections
- Feature areas (expenses, settlements, comments)
- Admin panels

---

#### 2.4 Focus Management Extraction

**Problem:** Focus management utilities exist in Modal.tsx but aren't exported for reuse.

**Current state:**
- `useFocusTrap` and `useFocusRestoration` are internal to Modal
- Other components use ad-hoc setTimeout-based focus
- Inconsistent delay values (0ms vs 100ms)

**Proposed work:**
- Export `useFocusTrap` and `useFocusRestoration` as public hooks
- Create `useAutoFocus(ref, options)` hook for delayed focus
- Document why delays are needed

---

### Priority 3: LOWER IMPACT

#### 3.1 Popover Position Hook

**Problem:** Position calculation code is duplicated across components.

**Examples:**
- `CurrencyAmountInput.tsx`: Position calculation with scroll/resize listeners
- `ReactionPicker.tsx`: Nearly identical position calculation

**Proposed solution:** Extract `usePopoverPosition()` hook with:
- Initial position calculation
- Auto-flip when near viewport edges
- Scroll/resize listener management
- Cleanup

---

#### 3.2 Debounce/Throttle Improvements

**Problem:** Direct setTimeout usage instead of debounce utilities; no throttle hook.

**Current state:**
- `useDebounce` hook exists but isn't widely used
- Magic numbers for delays scattered throughout
- No throttle hook for scroll/resize

**Proposed work:**
- Add `useDebouncedCallback` variant
- Create `useThrottle` hook
- Extract delay constants

---

#### 3.3 Computed Signal Helpers

**Problem:** Limited use of Preact's `computed()` signals; manual derivation common.

**Current state:**
- Only one computed signal found in stores
- Components use plain getters for derived state
- `useState(() => signal(...))` pattern repeated (now addressed by useLocalSignal)

**Proposed work:**
- Create `useComputed()` wrapper hook for component use
- Document when to use computed vs plain getters
- Add examples to style guide

---

## Adoption Tracking

### useAsyncAction - Migration Candidates

Components NOT using useAsyncAction that should:
- [ ] `CommentInput.tsx` - Manual isSubmitting + try/catch
- [ ] `SettlementForm.tsx` - Multiple signal-based loading/error states
- [ ] `UserEditorModal.tsx` - Multiple independent state variables
- [ ] `TenantEditorModal.tsx` - Multiple independent state variables

### ListStateRenderer - Migration Candidates

- [ ] `SettlementHistory.tsx`
- [ ] `ActivityFeedDropdownContent.tsx`
- [ ] `GroupActivityFeed.tsx`

### useClickOutside - Migration Candidates

- [ ] `ReactionPicker.tsx` - Uses excludeRef pattern (needs testing)

---

## Completed Phases

### Phase 3: New Hooks (COMPLETE)

| Hook | Purpose | Tests |
|------|---------|-------|
| `useLocalSignal` | Encapsulates `useState(() => signal(...))` | 15 |
| `useClickOutside` | Dropdown click-outside detection | 13 |
| `useAsyncAction` | Async operations with loading/error | 17 |

### Phase 2: Modal/List Migrations (COMPLETE)

- useModalOpen / useModalOpenOrChange hooks
- ListStateRenderer component
- ModalFormFooter component
- FormFieldLabel component

### Phase 1: Layout Components (COMPLETE)

- Initial layout components and utilities

---

## Files Reference

### Phase 3 Files Created
- `src/app/hooks/useLocalSignal.ts`
- `src/app/hooks/useClickOutside.ts`
- `src/app/hooks/useAsyncAction.ts`
- `src/app/hooks/index.ts`
- Tests for all three hooks

### Phase 3 Files Modified
- `src/pages/LoginPage.tsx` - useLocalSignal migration
- `src/components/layout/UserMenu.tsx` - useClickOutside migration
- `src/components/layout/NotificationsDropdown.tsx` - useClickOutside migration
- `src/components/ui/LanguageSwitcher.tsx` - useClickOutside migration
