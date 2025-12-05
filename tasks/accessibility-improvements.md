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

## Issues to Address

### 1. Focus Trap in Modals (High Priority)

**Problem:** Tab key can escape modal to background content, losing user context.

**Affected files:**
- `webapp-v2/src/components/ui/Modal.tsx`
- `webapp-v2/src/components/ui/ConfirmDialog.tsx`

**Solution:** Implement focus trapping so Tab/Shift+Tab cycles within modal only.

Options:
- Use `focus-trap-react` library
- Implement custom trap with first/last focusable element detection

```tsx
// Example pattern
useEffect(() => {
    if (!isOpen) return;

    const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
        }
    };

    document.addEventListener('keydown', handleTab);
    firstElement?.focus();
    return () => document.removeEventListener('keydown', handleTab);
}, [isOpen]);
```

### 2. Focus Restoration After Modal Close (High Priority)

**Problem:** When modal closes, focus is lost. Users must navigate back to context.

**Affected files:**
- `webapp-v2/src/components/ui/Modal.tsx`

**Solution:** Store trigger element ref and restore focus on close.

```tsx
// In Modal.tsx
const triggerRef = useRef<HTMLElement | null>(null);

useEffect(() => {
    if (isOpen) {
        triggerRef.current = document.activeElement as HTMLElement;
    } else {
        triggerRef.current?.focus();
    }
}, [isOpen]);
```

### 3. Skip Link (Medium Priority)

**Problem:** Keyboard users must tab through all navigation before reaching main content.

**Affected files:**
- `webapp-v2/src/components/layout/Header.tsx`
- `webapp-v2/src/components/layout/BaseLayout.tsx`

**Solution:** Add skip-to-main-content link at start of page.

```tsx
// In Header.tsx or BaseLayout.tsx
<a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-surface-raised focus:text-text-primary focus:rounded-md"
>
    {t('accessibility.skipToContent')}
</a>

// In BaseLayout.tsx
<main id="main-content" tabIndex={-1}>
```

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

- [ ] Focus trapped within open modals
- [ ] Focus returns to trigger element when modal closes
- [ ] Skip link visible on focus, jumps to main content
- [ ] Keyboard navigation works in all modals and dropdowns
- [ ] No axe-core violations
- [ ] VoiceOver announces all form errors
