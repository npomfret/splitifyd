# Accessibility Improvements

## Overview

Audit of webapp-v2 accessibility patterns found strong implementation but identified gaps in focus management and navigation shortcuts.

## Current State (Strong)

The codebase has comprehensive accessibility:
- 187 ARIA attribute instances across UI components
- Semantic HTML landmarks (`<main>`, `<nav>`, `<header>`, `<footer>`)
- Form accessibility with label associations, error announcements, required indicators
- Screen reader announcements via `aria-live` and `role="alert"`
- Consistent focus-visible styling
- Keyboard navigation (Escape closes modals, Enter/Space on cards)
- `prefers-reduced-motion` support in Modal
- All icons have `aria-hidden="true"`
- **Focus trap in modals** (Tab/Shift+Tab cycles within modal)
- **Focus restoration** (focus returns to trigger element when modal closes)
- **Skip-to-content link** (keyboard users can bypass navigation)

## Completed (December 2024)

### 1. Focus Trap in Modals ✅

**Implementation:** Added `useFocusTrap` hook to `Modal.tsx`
- Queries all focusable elements within modal
- Traps Tab/Shift+Tab to cycle within modal boundaries
- Sets initial focus to first focusable element on open
- Re-queries elements dynamically to handle content changes

**Files modified:**
- `webapp-v2/src/components/ui/Modal.tsx`

### 2. Focus Restoration After Modal Close ✅

**Implementation:** Added `useFocusRestoration` hook to `Modal.tsx`
- Stores `document.activeElement` when modal opens
- Restores focus to trigger element when modal closes
- Checks element is still in DOM before focusing

**Files modified:**
- `webapp-v2/src/components/ui/Modal.tsx`

### 3. Skip Link ✅

**Implementation:** Added skip-to-content link in `BaseLayout.tsx`
- Visually hidden (`sr-only`) but revealed on focus
- Targets `#main-content` on the `<main>` element
- Uses semantic color tokens for styling
- Added `tabIndex={-1}` to main for programmatic focus

**Files modified:**
- `webapp-v2/src/components/layout/BaseLayout.tsx`
- `webapp-v2/src/locales/en/translation.json` (added `accessibility.skipToContent`)

## Remaining Issues (Low Priority)

### 4. Consistent Error Announcement Pattern (Low Priority)

**Problem:** FormField conditionally uses `role="alert"` only when there's an error.

**Affected file:**
- `webapp-v2/src/components/ui/FormField.tsx` (line 64)

**Current:**
```tsx
role={hasError ? 'alert' : undefined}
```

**Recommendation:** Keep current pattern but ensure aria-live="polite" is used for dynamic error appearance:
```tsx
<div role="alert" aria-live="polite">
    {error && <span>{error}</span>}
</div>
```

### 5. Dropdown Keyboard Navigation Consistency (Low Priority)

**Problem:** CurrencyAmountInput has arrow key navigation, but pattern not documented or consistent across all dropdowns.

**Recommendation:**
- Document the keyboard pattern in style guide
- Ensure Select.tsx and other dropdowns follow same pattern

## Testing Requirements

After implementation:
1. Test with VoiceOver (macOS)
2. Test with NVDA (Windows)
3. Run axe-core automated checks
4. Verify WCAG 2.1 AA compliance

## Files to Update

| File | Changes |
|------|---------|
| `Modal.tsx` | Add focus trap, focus restoration |
| `ConfirmDialog.tsx` | Inherit Modal's focus management |
| `Header.tsx` or `BaseLayout.tsx` | Add skip link |
| `FormField.tsx` | Consider aria-live enhancement |
| `docs/guides/webapp-and-style-guide.md` | Document accessibility patterns |

## i18n Keys Needed

```json
{
    "accessibility": {
        "skipToContent": "Skip to main content"
    }
}
```

## Acceptance Criteria

- [x] Focus trapped within open modals
- [x] Focus returns to trigger element when modal closes
- [x] Skip link visible on focus, jumps to main content
- [ ] Keyboard navigation works in all modals and dropdowns
- [ ] No axe-core violations
- [ ] VoiceOver announces all form errors
