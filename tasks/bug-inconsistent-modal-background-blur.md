# Bug: Inconsistent Modal Background Blur

**Status:** COMPLETED

**Problem:** When a modal opens, the background blurs, but the amount or quality of this blur appears inconsistent across different modals in the application. Specifically, the "Invite Others" modal has been identified as exhibiting this inconsistency. This leads to a visually jarring and less polished user experience.

**Root Cause:**
`SettlementForm.tsx` implemented its own custom modal overlay instead of using the shared `Modal` component:
- `Modal.tsx` uses `backdropFilter: 'blur(4px)'` (inline style)
- `SettlementForm.tsx` used `backdrop-blur-sm` (Tailwind class) on a custom overlay

**Solution Implemented:**
Refactored `SettlementForm.tsx` to use the `Modal` component instead of its custom overlay. This ensures all modals use the same blur implementation.

**Changes Made:**
- `webapp-v2/src/components/settlements/SettlementForm.tsx`:
  - Added `Modal` import
  - Replaced custom `<div class='fixed inset-0 bg-black/40 backdrop-blur-sm ...'>` wrapper with `<Modal>`
  - Removed manual escape key handler (Modal handles this)
  - Removed backdrop click handler (Modal handles this)
  - Removed unused `modalRef`
  - Restructured content to match Modal's header/content pattern

- `webapp-v2/src/pages/JoinGroupPage.tsx`:
  - Added `Modal` import
  - Replaced custom display name prompt overlay with `<Modal>` component
  - Restructured content to match Modal's pattern

- `packages/test-support/src/page-objects/SettlementFormPage.ts`:
  - Updated `selectCurrency` method to find currency dropdown at page level (since it uses portal rendering)

**Testing:**
- Build compiles successfully
- All 15 settlement form Playwright tests pass

**Note:** The "Invite Others" modal (`ShareGroupModal.tsx`) was already using the `Modal` component correctly. All modals now use consistent blur.
