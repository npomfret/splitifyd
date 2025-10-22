# Audit & Refactor: Icon Accessibility and Internationalization

## 1. Summary

This audit reviewed all icon usage within the `webapp-v2` TSX codebase to assess accessibility (`a11y`) and internationalization (`i18n`) readiness.

**Findings:**
- **Inconsistent Implementation:** There is no single, enforced standard for making icon-only buttons accessible. We have a mix of `aria-label`, `title`, both, or neither.
- **No Standard Tooltip:** The app lacks a reusable, accessible tooltip component, leading to reliance on the native `title` attribute, which provides a poor user experience and has inconsistent screen reader support.
- **Good-but-Incomplete i18n:** Most existing labels are correctly sourced from translation files, but some are hardcoded, and many icons lack labels entirely.

This inconsistency creates a confusing experience for users with accessibility needs and makes the application harder to maintain and translate.

## 2. The Problem

1.  **Inaccessible Controls:** Icon-only buttons without an `aria-label` are "phantom buttons" to screen reader users. They are announced as "button, unlabeled," providing no context for their function.
2.  **Poor User Experience:** Icons that are not universally understood (e.g., `UserMinusIcon`) can be confusing without a tooltip to explain their action on hover. The native `title` attribute is a poor substitute as it cannot be styled, is not mobile-friendly, and is not reliably announced by screen readers.
3.  **Maintenance Overhead:** Without a clear standard, developers will continue to implement icons inconsistently, increasing tech debt and requiring repeated fixes.
4.  **Incomplete Translation:** Hardcoded labels (e.g., "Send comment") cannot be translated.

## 3. Proposed Solution: A Standardized Approach

To fix this, we will implement a consistent, project-wide standard for all icons, especially those used in interactive elements.

### Step 1: Create a Reusable `Tooltip` Component

First, we must create a new, accessible `Tooltip` component in `webapp-v2/src/components/ui/Tooltip.tsx`. This component should:
- Be built on a headless UI library like `preact-aria` or a similar lightweight solution to ensure it follows WAI-ARIA patterns.
- Trigger on both mouse hover and keyboard focus.
- Use `aria-describedby` to link the tooltip content to the trigger element.
- Be fully stylable with Tailwind CSS.

### Step 2: Enforce a New Standard for Icon-Only Buttons

All icon-only buttons **MUST** adhere to the following structure:

```tsx
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/Tooltip';
import { SomeIcon } from '@heroicons/react/24/outline';

const { t } = useTranslation();

// ...

<Tooltip text={t('namespace.tooltipText')}>
  <button
    aria-label={t('namespace.screenReaderLabel')}
    // ... other props
  >
    <SomeIcon className='h-5 w-5' />
  </button>
</Tooltip>
```

**Key Rules:**
1.  The `aria-label` provides the essential text for screen readers. It is **mandatory**.
2.  The `<Tooltip>` component provides the visual aid for sighted users. It is **mandatory** for any icon whose function is not immediately obvious.
3.  Both the `aria-label` and the `Tooltip` text **MUST** be sourced from translation files using the `t()` function.

## 4. Detailed Audit & Action Plan

The following files contain icons that need to be updated to the new standard.

| File | Icon | Current State | Action Required |
| --- | --- | --- | --- |
| **`MembersListWithManagement.tsx`** | `UserMinusIcon` | 🔴 **Bad** | Missing both `aria-label` and a tooltip. |
| **`SettlementHistory.tsx`** | `PencilIcon` | 🟡 **Partial** | Has a `title` attribute but is missing `aria-label`. |
| **`SettlementHistory.tsx`** | `TrashIcon` | 🟡 **Partial** | Has a `title` attribute but is missing `aria-label`. |
| **`GroupHeader.tsx`** | `CogIcon` | 🟡 **Partial** | Has a proper `aria-label` but lacks a visual tooltip. |
| **`CommentInput.tsx`** | `PaperAirplaneIcon` | 🟡 **Partial** | Has a hardcoded `aria-label="Send comment"`. |
| **`ExpenseBasicFields.tsx`** | `ClockIcon` | ✅ **Good** | Has both `aria-label` and `title`, both using i18n. This is the best current example. |

### Implementation Plan:

1.  **Create `Tooltip.tsx`:** Implement the reusable tooltip component as described above.
2.  **Update `MembersListWithManagement.tsx`:**
    - Wrap the `UserMinusIcon` button in the new `Tooltip`.
    - Add `aria-label={t('membersList.removeMemberAriaLabel')}` to the button.
    - Add the tooltip text `t('membersList.removeMemberTooltip')`.
    - Add new keys to the relevant translation file.
3.  **Update `SettlementHistory.tsx`:**
    - For both the `PencilIcon` and `TrashIcon` buttons:
        - Wrap them in the new `Tooltip` component, using the existing `title` text as the source for the new i18n key.
        - Add a proper `aria-label` using a new i18n key (e.g., `t('settlementHistory.editSettlementAriaLabel')`).
        - Remove the legacy `title` attribute.
4.  **Update `GroupHeader.tsx`:**
    - Wrap the `CogIcon` button in the new `Tooltip`.
    - Use `t('groupHeader.groupSettingsTooltip')` for the tooltip text.
    - Keep the existing `aria-label`.
5.  **Update `CommentInput.tsx`:**
    - Change the hardcoded `aria-label` on the `PaperAirplaneIcon` button to use `t('comments.commentInput.sendAriaLabel')`.
    - Add a corresponding key to the translation file. A tooltip is likely not needed here as the icon's function is standard.
6.  **Final Review:** Once all fixes are implemented, perform a final review to ensure consistency and run tests.
