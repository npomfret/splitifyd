# UI Code Audit Findings (webapp-v2/src)

This document summarizes inconsistencies found during an audit of the `webapp-v2/src` codebase against the project's established guidelines (`docs/guides/*.md`).

## 1. ~~State Management: `useState` vs. Preact Signals~~ RESOLVED

**Status:** Fixed (2025-12-01)

All components have been migrated from `useState` to Preact Signals using the correct pattern: wrapping signal initialization within `useState` to avoid stale state across component instances.

### Pattern Applied:
```typescript
// Component-local signals - initialized within useState to avoid stale state across instances
const [loadingSignal] = useState(() => signal(false));
const [errorSignal] = useState(() => signal<string | null>(null));

// Extract signal values for use in render
const loading = loadingSignal.value;
const error = errorSignal.value;
```

### Files Fixed (11 components):

| Component | useState calls migrated |
|-----------|------------------------|
| `pages/ResetPasswordPage.tsx` | 4 (fixed module-level anti-pattern) |
| `pages/SettingsPage.tsx` | 18 |
| `pages/RegisterPage.tsx` | 8 |
| `pages/LoginPage.tsx` | 3 |
| `components/ui/Modal.tsx` | 1 |
| `components/ui/Alert.tsx` | 1 |
| `components/ui/ImageUploadField.tsx` | 6 |
| `components/settlements/SettlementForm.tsx` | 11 |
| `components/policy/PolicyAcceptanceModal.tsx` | 6 |
| `components/group/ShareGroupModal.tsx` | 8 |
| `components/group/GroupSettingsModal.tsx` | 30 |

### Admin Components (unchanged - not in scope):
Admin components (`AdminTenantsPage.tsx`, `TenantEditorModal.tsx`, `AdminTenantsTab.tsx`, `AdminDiagnosticsTab.tsx`) were excluded from this migration as they are not tenant-themed and follow different patterns.

## 2. ~~Styling: Hardcoded Colors vs. Semantic Tokens~~ RESOLVED

**Status:** Fixed (2025-12-01)

All `text-white` violations in non-admin components have been replaced with `text-text-inverted` to comply with white-label theming requirements.

### Files Fixed (13 violations across 8 files):

| File | Changes |
|------|---------|
| `components/ui/WarningBanner.tsx` | `text-white` → `text-text-inverted` |
| `components/group/ShareGroupModal.tsx` | `text-white` → `text-text-inverted` (toast) |
| `components/expense-form/SplitAmountInputs.tsx` | 3x `dark:text-white` → `dark:text-text-inverted` |
| `components/expense/SplitBreakdown.tsx` | 4x `text-white`/`dark:text-white` → `text-text-inverted`/`dark:text-text-inverted` |
| `components/comments/CommentItem.tsx` | `text-white` → `text-text-inverted` (avatar) |
| `components/settlements/SettlementForm.tsx` | `text-white` → `text-text-inverted` (avatar) |
| `pages/ExpenseDetailPage.tsx` | `text-white` + `focus:ring-white` → `text-text-inverted` + `focus:ring-text-inverted` |
| `app/providers/AuthProvider.tsx` | `text-white` → `text-text-inverted` (button) |

### Admin Page Exceptions (unchanged - allowed per style guide):
Admin components (`AdminTenantsPage.tsx`, `TenantBrandingPage.tsx`, `AdminHeader.tsx`, `UserEditorModal.tsx`) correctly utilize hardcoded colors, which is explicitly allowed by the style guide for admin UI that is not tenant-themed.

## 3. Component Structure and Size (Maintainability Concern)

Excessively large components become difficult to read, understand, and maintain, increasing cognitive load for developers.

### Finding:

*   **Oversized Component:** `webapp-v2/src/components/admin/TenantEditorModal.tsx` is extremely large, exceeding **2700 lines of code**. It handles a vast array of tenant branding properties (colors, typography, spacing, motion settings, etc.) within a single file.

### Recommendation:
The `TenantEditorModal.tsx` component is a prime candidate for refactoring. It should be broken down into smaller, more focused sub-components. Each logical section (e.g., "Palette Colors", "Typography Settings", "Motion & Effects") could be its own component, improving modularity, readability, and maintainability.

## 4. Typing and Code Quality (Minor Issue)

Maintaining strong type safety is a core principle (`docs/guides/general.md`, `docs/guides/code.md`).

### Finding:

*   **Incomplete Typing:** `webapp-v2/src/components/expense-form/SplitAmountInputs.tsx` contains a `// todo: should these be strongly typed?` comment for the `Split` interface. This indicates a known area where type safety could be improved.

### Recommendation:
Define a proper, strongly typed interface for `Split` (and potentially other similar data structures) and move it to a shared location (`@billsplit-wl/shared`) if it's a DTO or a type used across multiple components, as per the `docs/guides/types.md` guidelines.

---

## Summary

| Issue | Status | Priority |
|-------|--------|----------|
| 1. State Management (`useState` vs Signals) | **RESOLVED** | ~~Significant~~ |
| 2. Styling (Hardcoded Colors) | **RESOLVED** | ~~Minor~~ |
| 3. Component Size (`TenantEditorModal.tsx`) | Open | Low (admin-only) |
| 4. Typing (`Split` interface) | Open | Minor |

**Next Steps:**
Remaining open issues (3 and 4) are low priority and admin-only. No urgent action required.
