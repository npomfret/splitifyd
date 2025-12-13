# RTL Internationalization: Deep Dive & Implementation Plan

## Goal
To perform a comprehensive audit of the `webapp-v2` codebase and create a detailed plan to flawlessly implement Right-to-Left (RTL) language support. This is not an afterthought; the goal is a first-class, maintainable, and robust RTL user experience.

## Executive Summary
The `webapp-v2` codebase is in a good position to adopt RTL support thanks to its modern stack (Preact, Tailwind CSS v4, i18next).

**Key insight (December 2024 review):** This project uses **Tailwind CSS v4**, which uses CSS logical properties by default for horizontal spacing utilities. This significantly reduces the migration scope compared to Tailwind v3.x projects.

The remaining work focuses on:
1. Infrastructure: Dynamic `dir` attribute switching based on language
2. Targeted migrations: Absolute positioning (`left-*`/`right-*` → `start-*`/`end-*`), text alignment (`text-left`/`text-right` → `text-start`/`text-end`)
3. Icon flipping for directional icons
4. Prerequisite work from `tasks/i18n-multi-language-support.md` (dynamic language loading, locale-aware formatters)

---

## Critical: Tailwind v4 Logical Properties

**This section was added after research review (December 2024)**

Tailwind CSS v4 changed how horizontal spacing utilities work. Utilities like `ml-*`, `mr-*`, `pl-*`, `pr-*`, `mx-*`, `px-*` now generate **CSS logical properties** by default:

```css
/* Tailwind v4 output for ml-4 */
.ml-4 {
  margin-inline-start: 1rem; /* NOT margin-left */
}
```

### What This Means

| Utility Category | Tailwind v3 Output | Tailwind v4 Output | Migration Needed? |
|-----------------|-------------------|-------------------|-------------------|
| `ml-*`, `mr-*` | `margin-left/right` | `margin-inline-start/end` | **No** |
| `pl-*`, `pr-*` | `padding-left/right` | `padding-inline-start/end` | **No** |
| `mx-*`, `px-*` | `margin/padding-left + right` | `margin/padding-inline` | **No** |
| `left-*`, `right-*` | `left/right` | `left/right` (physical) | **Yes** → `start-*`/`end-*` |
| `text-left`, `text-right` | `text-align: left/right` | `text-align: left/right` (physical) | **Yes** → `text-start`/`text-end` |
| `border-l-*`, `border-r-*` | `border-left/right` | Logical in v4 | **Verify** |

### Reduced Migration Scope

The original plan estimated ~41 occurrences of physical properties needing migration. With Tailwind v4:
- **Margin/padding classes (`ml-*`, `mr-*`, `pl-*`, `pr-*`):** No longer need migration
- **Still need migration:** `left-*`/`right-*` positioning, `text-left`/`text-right` alignment

**Recommendation:** Run audit commands to identify only the utilities that still use physical properties in v4.

---

## Prerequisite: i18n Infrastructure

The following work from `tasks/i18n-multi-language-support.md` must be completed first or in parallel:

1. Dynamic language loading in `webapp-v2/src/i18n.ts`
2. Language detection (user profile → localStorage → navigator.language → 'en')
3. Locale-aware formatters (`dateUtils.ts`, `currencyFormatter.ts`)
4. Language switcher UI

This RTL task extends that work by adding the `dir` attribute handling.

## Core Strategy: Logical Properties & The `dir` Attribute
Our entire approach will hinge on two modern web standards:

1.  **The `dir` Attribute:** We will dynamically set `<html dir="rtl">` for RTL languages and `<html dir="ltr">` for LTR languages. This will be the single source of truth that triggers the browser's RTL layout engine.
2.  **CSS Logical Properties:** We will replace all physical directional properties with their logical counterparts. This ensures that our styling automatically adapts to the `dir` attribute, eliminating the need for extensive style overrides.

| Physical (Avoid) | Logical (Use) | Tailwind (Use) |
| :--- | :--- | :--- |
| `margin-left` | `margin-inline-start` | `ms-*` |
| `margin-right` | `margin-inline-end` | `me-*` |
| `padding-left` | `padding-inline-start` | `ps-*` |
| `padding-right` | `padding-inline-end` | `pe-*` |
| `left` | `inset-inline-start` | `start-*` |
| `right` | `inset-inline-end` | `end-*` |
| `text-align: left` | `text-align: start` | `text-start` |
| `border-left` | `border-inline-start` | `border-s-*` |
| `float: left` | `float: inline-start` | `float-start` |

## Detailed Analysis & Action Plan

### 1. HTML & Root Configuration
-   **File:** `webapp-v2/src/App.tsx`
-   **Action:** Implement a `useEffect` hook that listens to language changes from `i18next` and sets `document.documentElement.dir` accordingly.
    ```typescript
    // Pseudo-code for App.tsx
    import { useTranslation } from 'react-i18next';
    import { useEffect } from 'preact/hooks';

    // ...
    const { i18n } = useTranslation();
    useEffect(() => {
      document.documentElement.dir = i18n.dir(); // i18n.dir() returns 'ltr' or 'rtl'
    }, [i18n, i18n.language]);
    ```

### 2. Styling & CSS (Reduced Scope with Tailwind v4)

**Updated December 2024:** With Tailwind v4, the migration scope is significantly reduced.

#### What NO LONGER Needs Migration (v4 handles automatically)
-   `ml-*`, `mr-*` → Already use `margin-inline-start/end`
-   `pl-*`, `pr-*` → Already use `padding-inline-start/end`
-   `space-x-*` → Uses logical properties in v4
-   `divide-x-*` → Uses logical properties in v4

#### What STILL Needs Migration
-   **Files:** All `.tsx` files in `webapp-v2/src/` and `webapp-v2/src/styles/global.css`.
-   **Actions:**
    -   `text-left` → `text-start`
    -   `text-right` → `text-end`
    -   `left-*` (absolute positioning) → `start-*`
    -   `right-*` (absolute positioning) → `end-*`
    -   `float-left` → `float-start`
    -   `float-right` → `float-end`

#### Special Cases
-   **`transform` properties:** `translateX` may need to be inverted in RTL using `rtl:-translate-x-*` or conditional logic.
-   **`global.css` custom utilities:** Review any custom utilities defined with `@utility` for physical properties.

### 3. UI Component Library (`components/ui`)
Every component must be audited.

-   **`Modal.tsx` & `Toast.tsx`:** Pay close attention to the positioning of "close" buttons, which are often absolutely positioned in a top corner (`top-2 right-2`). This must become `top-2 end-2`.
-   **`Input.tsx` / `FloatingInput.tsx`:** If any icons are positioned inside the input (e.g., a search icon), ensure they are positioned with `start-*` or `end-*`, not `left-*` or `right-*`.
-   **`Button.tsx` / `Clickable.tsx`:** If a button contains an icon that implies direction (e.g., `<Button>Next <ArrowRightIcon /></Button>`), the icon itself needs to be flipped (see below).
-   **`Stack.tsx`:** Verify its implementation. If it uses `flex` and `gap`, it should be RTL-friendly. If it manually adds margins to children, it needs to be updated to use logical properties.

### 4. Icons
-   **Files:** `webapp-v2/src/components/ui/icons/`
-   **Action:** Identify all icons that are inherently directional.
    -   `ArrowLeftIcon`, `ArrowRightIcon`
    -   `ChevronLeftIcon`, `ChevronRightIcon`
    -   Any icon depicting movement or pointing.
-   **Strategy:** Apply a conditional class to flip them in RTL.
    ```jsx
    <ChevronRightIcon className="rtl:-scale-x-100" />
    ```
    The `-scale-x-100` transform will mirror the icon horizontally.

### 5. Layouts & Pages
-   **Files:** `webapp-v2/src/pages/**/*.tsx`
-   **Action:** Audit page layouts for any remaining physical properties. Pay special attention to page headers with actions aligned to the right, or any two-column layouts that might not be using Flexbox/Grid correctly.

### 6. i18n Library & Utilities
This work is outlined in `tasks/i18n-multi-language-support.md` and is a prerequisite.

-   **File:** `webapp-v2/src/i18n.ts`
-   **Action:**
    1.  Update `i18next` to support and dynamically load an RTL language (e.g., Arabic 'ar').
    2.  Ensure the `i18next-browser-languagedetector` is configured or that a custom detection order is implemented.
-   **Files:** `webapp-v2/src/utils/dateUtils.ts`, `webapp-v2/src/utils/currency/currencyFormatter.ts`
-   **Action:** Remove hardcoded locales (`'en-US'`, etc.) and pass in the current language (`i18n.language`) to all `Intl` formatters.

### 7. Third-Party Libraries
-   **Action:** Audit any third-party UI components (e.g., date pickers, charting libraries, sliders). Check their documentation for RTL support. If a library does not support it, we may need to find a replacement or apply manual CSS overrides. (A quick scan does not reveal any obvious problematic libraries, but this must be checked).

## Audit Commands

**Updated December 2024:** With Tailwind v4, focus on utilities that still use physical properties.

Use these `ripgrep` commands in the `webapp-v2` directory to find potential issues:

```bash
# STILL RELEVANT - Find physical positioning (absolute/fixed positioning)
rg '\b(left|right)-\d' --glob '*.tsx'

# STILL RELEVANT - Find physical text alignment
rg 'text-(left|right)\b' --glob '*.tsx'

# STILL RELEVANT - Find float utilities
rg 'float-(left|right)' --glob '*.tsx'

# STILL RELEVANT - Find raw inline styles (might contain directional properties)
rg 'style=\{\{' --glob '*.tsx'

# NO LONGER RELEVANT with Tailwind v4 (margin/padding already use logical properties)
# rg 'p(l|r)-|m(l|r)-' --glob '*.tsx'
# rg '(space|divide)-x-' --glob '*.tsx'
```

### Current Audit Results (December 2024)

Focused scan for items still needing migration:
- `text-left`/`text-right`: Found in several components
- `left-*`/`right-*` positioning: Found in Modal close buttons, dropdowns
- Inline styles: Minimal usage, needs review

## Proposed Phased Implementation

**Updated December 2024:** Phases revised to reflect reduced scope with Tailwind v4.

### Phase 1: Infrastructure (Complete prerequisite work)
*   Complete `tasks/i18n-multi-language-support.md` first:
    *   Dynamic language loading in `i18n.ts`
    *   Language detection logic
    *   Fix hardcoded locales in `dateUtils.ts` and `currencyFormatter.ts`
*   Add `dir` attribute switching in `App.tsx` using `i18n.dir()`
*   Add temporary language switcher UI for developers (e.g., `?lang=ar` query param)

### Phase 2: Targeted CSS Migrations (Smaller scope with v4)
*   Migrate `text-left`/`text-right` → `text-start`/`text-end`
*   Migrate `left-*`/`right-*` → `start-*`/`end-*` (absolute positioning)
*   Review `global.css` custom `@utility` definitions for physical properties
*   Focus on high-impact UI components: Modal close buttons, dropdowns, tooltips

### Phase 3: Icon Flipping
*   Inventory directional icons in `components/ui/icons/`
*   Add `rtl:-scale-x-100` to: ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, etc.
*   Consider creating a wrapper component or utility for consistent flipping

### Phase 4: QA & Testing
*   Perform full manual QA pass in RTL language (Arabic recommended for testing)
*   Implement visual regression tests as described below
*   Test in multiple browsers (Safari has historically had weaker logical property support)

## Testing Strategy
-   **Manual Testing:** Add a language selector to the development environment that is easily accessible. Testers must go through every user flow in both an LTR and an RTL language.
-   **Automated Visual Regression Testing:**
    *   Configure Playwright to run test suites in both LTR and RTL contexts.
    *   This can be achieved by creating a custom fixture that sets the language in `localStorage` before the test begins.
    *   For key pages and components, create screenshot tests for both `dir="ltr"` and `dir="rtl"`. The RTL screenshots should be committed to the repository as the new baseline. This will prevent future regressions.
    ```typescript
    // Example Playwright test concept
    test('Dashboard should render correctly in Arabic', async ({ page }) => {
      // Set language to Arabic before navigating
      await page.evaluate(() => localStorage.setItem('language', 'ar'));
      
      await page.goto('/dashboard');
      
      // Expect the dir attribute to be set
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      
      // Take a screenshot and compare against the baseline 'dashboard-ar.png'
      await expect(page).toHaveScreenshot('dashboard-ar.png');
    });
    ```

---

## Research References (December 2024)

- [Tailwind CSS v4.0 release notes](https://tailwindcss.com/blog/tailwindcss-v4) - Documents logical property changes
- [RTL Styling 101](https://rtlstyling.com/posts/rtl-styling/) - Comprehensive RTL guide
- [CSS Logical Properties - Smashing Magazine](https://www.smashingmagazine.com/2022/12/deploying-css-logical-properties-on-web-apps/) - Deployment strategies
- [i18next API - dir() method](https://www.i18next.com/overview/api) - Direction detection
- [Tailwind RTL Discussion #1492](https://github.com/tailwindlabs/tailwindcss/discussions/1492) - Community discussion on RTL support

## Open Questions

1. **Target RTL language:** Arabic (ar) is recommended for testing as it's widely used and well-supported. Hebrew (he) or Persian (fa) are alternatives.
2. **Sequencing with Ukrainian:** Should RTL work happen before, after, or in parallel with Ukrainian language support? Ukrainian is LTR, so the infrastructure work overlaps but RTL-specific work doesn't block it.
3. **Browser support baseline:** CSS logical properties are well-supported in modern browsers but Safari < 15 has gaps. What's our browser support target?

---

## Implementation Plan (December 2024 Audit)

### Audit Results Summary

| Category | Status | Details |
|----------|--------|---------|
| **i18n Prerequisites** | ✅ COMPLETE | Dynamic language loading, locale-aware formatters already work |
| **`dir` attribute switching** | ✅ COMPLETE | Added in App.tsx with i18n.dir() |
| **RTL language config** | ✅ COMPLETE | Arabic (ar) added to SUPPORTED_LANGUAGES |
| **Text alignment migration** | ✅ COMPLETE | 43 occurrences migrated across 22 files |
| **Position class migration** | ✅ COMPLETE | 19 occurrences migrated across 16 files |
| **Icon flipping** | ✅ COMPLETE | 4 directional icons now have `rtl:-scale-x-100` |
| **global.css** | ✅ SAFE | No physical properties found |

### Implementation Complete (December 2024)

All RTL infrastructure is now in place. To test:
1. Add `?lang=ar` to any URL or change language via settings
2. The entire UI should mirror automatically
3. Directional icons (chevrons, arrows, logout) flip in RTL mode

### Phase 1: Infrastructure (Effort: Low)

#### 1.1 Add `dir` attribute switching in App.tsx

**File:** `webapp-v2/src/App.tsx`

Add a `useEffect` hook to set `document.documentElement.dir` based on language:

```typescript
useEffect(() => {
    document.documentElement.dir = i18n.dir();
}, [i18n.language]);
```

#### 1.2 Add Arabic language support

**File:** `webapp-v2/src/i18n.ts`

- Add `'ar'` to the supported languages array
- Ensure `loadLanguageBundle()` can load Arabic translations

**File:** `webapp-v2/src/utils/languageDetection.ts`

- Add Arabic locale mapping: `ar: 'ar-SA'` (or `ar-EG`)

**File:** `webapp-v2/public/locales/ar/translation.json`

- Create Arabic translation file (can start with English copy for testing layout)

### Phase 2: CSS Migrations (Effort: Medium)

#### 2.1 Text Alignment Classes (40 occurrences)

**Migration:** `text-left` → `text-start`, `text-right` → `text-end`

| File | Occurrences |
|------|-------------|
| `AdminDiagnosticsTab.tsx` | Multiple |
| `AdminUsersTab.tsx` | Multiple |
| `AdminFormSection.tsx` | 1 |
| `PaletteColorsSection.tsx` | 1 |
| `ActivityFeedCard.tsx` | 1 |
| `CreateGroupModal.tsx` | 1 |
| `EmptyGroupsState.tsx` | 1 |
| `PayerSelector.tsx` | Multiple |
| `SplitAmountInputs.tsx` | 1 |
| `SplitBreakdown.tsx` | 1 |
| `ExpenseItem.tsx` | 1 |
| `GroupCurrencySettings.tsx` | Multiple |
| `CustomPermissionsSection.tsx` | 1 |
| `PermissionPresetsSection.tsx` | 1 |
| `LanguageSwitcher.tsx` | 1 |
| `UserMenu.tsx` | 1 |
| `CurrencyAmountInput.tsx` | 1 |
| `Skeleton.tsx` | 1 |
| `TimeInput.tsx` | 1 |
| `GroupActivityFeed.tsx` | 1 |
| `ResetPasswordPage.tsx` | 1 |

#### 2.2 Position Classes (20 occurrences)

**Migration:** `left-*` → `start-*`, `right-*` → `end-*`

| File | Current | Change To |
|------|---------|-----------|
| `ImageUploadField.tsx` | `right-2` (×2) | `end-2` |
| `Select.tsx` | `right-0` | `end-0` |
| `LanguageSwitcher.tsx` | `right-0` | `end-0` |
| `CommentInput.tsx` | `right-2` | `end-2` |
| `ExpenseDetailModal.tsx` | `right-2` | `end-2` |
| `SplitBreakdown.tsx` | `-right-1` | `-end-1` |
| `FloatingPasswordInput.tsx` | `right-0` | `end-0` |
| `GroupCurrencySettings.tsx` | `left-0` | `start-0` |
| `ShareGroupModal.tsx` | `right-2` | `end-2` |

**Note:** Modal close buttons (`top-2 right-2`) should become `top-2 end-2`.

### Phase 3: Icon Flipping (Effort: Low)

**Files to modify:** `webapp-v2/src/components/ui/icons/`

| Icon | Action |
|------|--------|
| `ChevronLeftIcon.tsx` | Add `rtl:-scale-x-100` to default className |
| `ChevronRightIcon.tsx` | Add `rtl:-scale-x-100` to default className |
| `ArrowRightIcon.tsx` | Add `rtl:-scale-x-100` to default className |

**Implementation approach:** Modify the icon components to include RTL flip by default, or create a wrapper utility.

```typescript
// Option A: Add to each icon component
export function ChevronRightIcon({ className = '', ...props }) {
    return (
        <svg className={`rtl:-scale-x-100 ${className}`} ...>
            ...
        </svg>
    );
}

// Option B: Create a DirectionalIcon wrapper (if many icons need this)
```

### Phase 4: Testing (Effort: Medium)

#### 4.1 Manual Testing Checklist

With Arabic language enabled, verify:
- [ ] Login/Registration pages
- [ ] Dashboard layout
- [ ] Group detail page
- [ ] Expense creation modal
- [ ] Settlement flow
- [ ] Settings pages
- [ ] Dropdown menus align correctly
- [ ] Modal close buttons in correct corner
- [ ] Icons point in correct direction

#### 4.2 Playwright Visual Regression Tests

Create RTL-specific tests in `webapp-v2/src/__tests__/integration/`:

```typescript
test.describe('RTL Layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('language', 'ar'));
    });

    test('Dashboard renders correctly in RTL', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await expect(page).toHaveScreenshot('dashboard-rtl.png');
    });

    test('Group detail page renders correctly in RTL', async ({ page }) => {
        // Navigate to a group
        await expect(page).toHaveScreenshot('group-detail-rtl.png');
    });
});
```

---

## Execution Order

1. **Phase 1.1** - Add `dir` attribute switching (required for anything else to work)
2. **Phase 1.2** - Add Arabic language support (needed for testing)
3. **Phase 2.1** - Migrate text alignment classes (bulk find-replace)
4. **Phase 2.2** - Migrate position classes (careful review needed)
5. **Phase 3** - Add icon flipping
6. **Phase 4** - Testing and QA

**Estimated total changes:** ~65 class modifications across ~25 files, plus 3-4 new/modified infrastructure files.
