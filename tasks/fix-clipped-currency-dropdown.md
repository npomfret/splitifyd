# Fix clipped currency selection dropdown in expense form

**Status:** COMPLETED

**Problem:** The dropdown for the currency selection in the expense form gets visually clipped when it extends beyond the border of its containing element, specifically the "expense detail" container. This degrades the user experience as the full list of currencies is not visible.

**Root Cause:**
The `ExpenseBasicFields` component uses `<Card variant='glass'>`, which applies the `.glass-panel` CSS class. This class has `overflow: hidden` (in `webapp-v2/src/styles/global.css:70`) to contain the hover glow effect. Since the currency dropdown was positioned `absolute` inside this container, it was clipped when extending beyond the Card boundaries.

**Solution Implemented:**
Used a **portal pattern** to render the dropdown outside the DOM hierarchy, escaping the `overflow: hidden` clipping context. This follows the same approach used by `Modal.tsx` and `Tooltip.tsx` in the codebase.

**Changes Made:**
- `webapp-v2/src/components/ui/CurrencyAmountInput.tsx`:
  - Added `createPortal` import from `preact/compat`
  - Added `useLayoutEffect` for position calculation
  - Added `DropdownPosition` interface and state
  - Added `triggerContainerRef` to track the input container's position
  - Added `calculatePosition` callback that uses `getBoundingClientRect()` to compute dropdown position
  - Added scroll/resize event listeners to recalculate position when page scrolls or resizes
  - Changed dropdown from `absolute` to `fixed` positioning via portal
  - Dropdown now renders via `createPortal(dropdown, document.body)` with calculated `top`, `left`, and `width` styles

**Testing:**
- Build compiles successfully
- Unit tests pass: `CurrencyAmountInput.test.tsx` (2 tests)
- Integration tests pass: `expense-form.test.ts` (32 tests including currency handling tests)
