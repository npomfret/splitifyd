# Inconsistencies Report

This report summarizes the inconsistencies found in the project's TypeScript (`.ts` and `.tsx`) files when compared against the established coding guidelines.

## Summary of Findings

### 1. Widespread use of `class` instead of `className` in `.tsx` files.

**Description:** A significant number of Preact components incorrectly use the `class` attribute for CSS styling instead of the correct `className` attribute. This is invalid in TSX and can lead to unexpected behavior or compilation issues depending on the configuration. This issue is present in many files, including most of the modal components.

**Impact:** Potential runtime errors (though Preact might be forgiving), reduced code quality, and non-adherence to JSX/TSX standards.

**Examples:**
- `webapp-v2/src/components/expense/ExpenseDetailModal.tsx`
- `webapp-v2/src/components/group/ShareGroupModal.tsx`
- `webapp-v2/src/components/admin/TenantEditorModal.tsx`
- And many other components, especially within `webapp-v2/src/components/admin/forms/`, `webapp-v2/src/components/layout/`, and `webapp-v2/src/pages/`.

### 2. Mixing `useState` and `useSignal`

**Description:** The webapp's style guide explicitly recommends against mixing `useState` and `useSignal` in the same component to maintain a clear state management pattern.

**Impact:** Can lead to confusion in state management, potentially making components harder to reason about and debug.

**Identified Components:**
- `webapp-v2/src/components/comments/CommentInput.tsx`
- `webapp-v2/src/components/expense/ExpenseDetailModal.tsx`
- `webapp-v2/src/components/settlements/SettlementHistory.tsx`

*Note: While a valid pattern exists for using `useState` to initialize a signal (as observed in `ShareGroupModal.tsx` to prevent signal re-creation), the identified instances appear to manage separate state properties using both hooks, which contradicts the guideline's intent.*

### 3. Use of Raw HTML Elements Instead of Custom UI Components

**Description:** The project includes a comprehensive set of custom UI components in `webapp-v2/src/components/ui`. However, some components are opting for raw HTML elements where a custom component equivalent exists.

**Impact:** Inconsistent UI/UX, potential for styling deviations, and missed opportunities to leverage centralized component logic (e.g., accessibility, theming).

**Identified Instances:**
- **Raw `<input>`:** `webapp-v2/src/components/expense-form/SplitAmountInputs.tsx` and `webapp-v2/src/components/group/ShareGroupModal.tsx` use a raw `<input>` element instead of the custom `Input` or `FloatingInput` components.

### 4. Use of Inline `style` Attributes

**Description:** The project's style guide explicitly prohibits the use of inline `style` attributes, advocating for Tailwind CSS classes and semantic tokens for styling.

**Impact:** Makes styling harder to maintain, bypasses the theming system, and can override intended component styles.

**Identified Instances:**
- `webapp-v2/src/components/expense/SplitBreakdown.tsx`: An inline `style` attribute is used for setting a dynamic width (e.g., `style={{ width: '...' }}`).
- `webapp-v2/src/components/expense/ExpenseDetailModal.tsx`: An inline `style` attribute is used for the receipt modal overlay background color (e.g., `style={{ backgroundColor: '...' }}`).

### 5. Other Inconsistencies

**Description:**
- **Emoji Icon:** `webapp-v2/src/components/expense/ExpenseDetailModal.tsx` uses a `⚠️` emoji. The style guide explicitly recommends using Heroicons for icons to ensure consistency and proper theming.
- **Hardcoded Strings:** `webapp-v2/src/components/expense/ExpenseDetailModal.tsx` contains hardcoded strings within the `navigator.share` functionality. These user-facing strings should be internationalized using the `t()` function to support multi-language environments.

---

## Conclusion and Recommendations

The codebase generally follows the established guidelines, but these inconsistencies, particularly the widespread use of `class` instead of `className`, detract from the overall code quality and adherence to project standards.

**Recommendations for immediate action:**

1.  **Prioritize fixing `class` to `className`:** This is the most prevalent issue and can be addressed with a global find-and-replace, followed by careful review.
2.  **Replace raw `<input>` with custom `Input` components:** This will ensure consistent styling and behavior across forms.
3.  **Address inline `style` attributes:** Replace with appropriate Tailwind classes or explore custom CSS properties if dynamic values are strictly necessary and cannot be achieved otherwise.
4.  **Refactor state management in identified components:** Align `useState` and `useSignal` usage with the recommended patterns.
5.  **Internationalize hardcoded strings and replace emoji icons:** Use `t()` for all user-facing text and switch to Heroicons for visual elements.

Addressing these points will significantly improve the consistency, maintainability, and quality of the `webapp-v2` codebase.
