# UI Code Audit Findings (webapp-v2/src)

This document summarizes inconsistencies found during an audit of the `webapp-v2/src` codebase against the project's established guidelines (`docs/guides/*.md`).

## 1. State Management: `useState` vs. Preact Signals (Significant Inconsistency)

The project guidelines (`docs/guides/code.md`, `docs/guides/webapp-and-style-guide.md`) strongly advocate for using **Preact Signals** as the core reactivity and state management system, emphasizing proper encapsulation through private class fields for stores. While stores generally adhere to this, many components continue to use `useState` for local component state, creating inconsistency and missing opportunities to leverage the benefits of signals.

### Violations/Inconsistencies:

*   **Prevalence of `useState` for Local State:** Many components use `useState` for managing local form data, loading states, error messages, and UI toggles.
    *   `webapp-v2/src/pages/SettingsPage.tsx`
    *   `webapp-v2/src/pages/RegisterPage.tsx`
    *   `webapp-v2/src/pages/LoginPage.tsx`
    *   `webapp-v2/src/components/ui/Modal.tsx`
    *   `webapp-v2/src/components/ui/Alert.tsx`
    *   `webapp-v2/src/components/ui/ImageUploadField.tsx`
    *   `webapp-v2/src/components/settlements/SettlementForm.tsx`
    *   `webapp-v2/src/components/policy/PolicyAcceptanceModal.tsx`
    *   `webapp-v2/src/components/group/ShareGroupModal.tsx`
    *   `webapp-v2/src/components/group/GroupSettingsModal.tsx`
    *   `webapp-v2/src/pages/AdminTenantsPage.tsx`
    *   `webapp-v2/src/components/admin/TenantEditorModal.tsx`
    *   `webapp-v2/src/components/admin/AdminTenantsTab.tsx`
    *   `webapp-v2/src/components/admin/AdminDiagnosticsTab.tsx`
*   **Module-Level Signal (Anti-Pattern):** `webapp-v2/src/pages/ResetPasswordPage.tsx` declares `emailSignal` at the module level:
    ```typescript
    const emailSignal = signal('');
    ```
    This directly violates the `code.md` guideline: "Never declare signals at the module level outside the class" as it breaks encapsulation, allowing any code to mutate it directly.
*   **Mixed Approach:** `webapp-v2/src/pages/LoginPage.tsx` and `webapp-v2/src/pages/JoinGroupPage.tsx` correctly access signal values from stores (`authStore.errorSignal.value`, `useComputed` from `authStore.user`) but still manage their own local component state with `useState`.

### Best Practices Adherence:

*   **`webapp-v2/src/pages/GroupDetailPage.tsx`:** Demonstrates good use of `useComputed` and `useSignal` for managing and deriving state, aligning well with the recommended pattern for complex page-level components.
*   **`webapp-v2/src/components/dashboard/CreateGroupModal.tsx`:** Exemplifies the correct approach for component-local signals by initializing them within `useState` to avoid stale state issues across modal instances:
    ```typescript
    const [groupNameSignal] = useState(() => signal(''));
    ```

### Recommendation:
Refactor components currently using `useState` for local state to leverage Preact Signals. This will ensure consistency across the codebase and fully embrace the chosen state management paradigm. The module-level signal in `ResetPasswordPage.tsx` must be moved into the component's state or an appropriate store.

## 2. Styling: Hardcoded Colors vs. Semantic Tokens (Minor Inconsistency)

The `webapp-and-style-guide.md` explicitly states: "**Use semantic tokens only. Never `bg-gray-*`, `text-white`, inline styles, or `:root` variables in CSS files.**" while noting that Admin pages can use hardcoded colors. This guideline aims for white-label compatibility.

### Violations/Inconsistencies:

*   **Direct `text-white` Usage:**
    *   `webapp-v2/src/components/ui/WarningBanner.tsx`: Uses `text-white`. This should be `text-text-inverted` for semantic consistency and white-labeling.
    *   `webapp-v2/src/components/group/ShareGroupModal.tsx`: Uses `text-white` in the toast notification. This should also be `text-text-inverted`.
    *   `webapp-v2/src/components/expense-form/SplitAmountInputs.tsx`: Uses `dark:text-white`. This should be `dark:text-text-inverted`.

### Admin Page Exceptions:
Admin components (`AdminTenantsPage.tsx`, `TenantEditorModal.tsx`, `AdminDiagnosticsTab.tsx`) correctly utilize hardcoded colors (e.g., `bg-slate-900`, `text-indigo-600`, `text-gray-800`), which is explicitly allowed by the style guide for admin UI that is not tenant-themed.

### Recommendation:
Replace direct uses of `text-white` with `text-text-inverted` in non-admin components to align with semantic token usage and white-label design principles.

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

**Next Steps:**
I will await your instructions on which of these inconsistencies, if any, you would like me to address first.
