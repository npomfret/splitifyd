# RTL Internationalization: Deep Dive & Implementation Plan

## Goal
To perform a comprehensive audit of the `webapp-v2` codebase and create a detailed plan to flawlessly implement Right-to-Left (RTL) language support. This is not an afterthought; the goal is a first-class, maintainable, and robust RTL user experience.

## Executive Summary
The `webapp-v2` codebase is in a good position to adopt RTL support thanks to its modern stack (Preact, Tailwind CSS, i18next). However, a significant portion of the styling relies on physical, directional CSS properties (e.g., `margin-left`) rather than modern logical properties (e.g., `margin-inline-start`).

The core of this effort will be a systematic, codebase-wide migration from physical to logical properties. This will be paired with infrastructure changes to dynamically load RTL languages and adjust the UI's direction based on the selected language. While extensive, this migration is highly achievable and will result in a cleaner, more maintainable stylesheet for all languages.

This plan overlaps with and expands upon the infrastructure work outlined in `tasks/i18n-multi-language-support.md`.

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

### 2. Styling & CSS (The Core Task)
This is the most labor-intensive part of the migration. We must audit the entire codebase for physical properties and replace them.

-   **Files:** All `.tsx` files in `webapp-v2/src/` and `webapp-v2/src/styles/global.css`.
-   **Action:** Systematically replace all instances of directional Tailwind classes with their logical equivalents.
    -   `ml-*` → `ms-*`
    -   `mr-*` → `me-*`
    -   `pl-*` → `ps-*`
    -   `pr-*` → `pe-*`
    -   `space-x-*` → This utility is based on margins. It should be used with caution. For simple cases, it will reverse correctly. For complex layouts, replacing it with `flex` and `gap` is more robust.
    -   `divide-x-*` → Same as `space-x-*`.
    -   `text-left` → `text-start`
    -   `left-*` / `right-*` (for absolute positioning) → `start-*` / `end-*`
-   **Special Cases:** Look for any `transform` properties. `translateX` may need to be inverted in RTL.

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
Use these `ripgrep` commands in the `webapp-v2` directory to find potential issues:

```bash
# Find physical margin/padding classes
rg 'p(l|r)-|m(l|r)-' --glob '*.tsx'

# Find space-x/divide-x utilities
rg '(space|divide)-x-' --glob '*.tsx'

# Find physical positioning/alignment
rg '(left|right)-|text-(left|right)' --glob '*.tsx'

# Find raw inline styles (might contain directional properties)
rg 'style=\{\{' --glob '*.tsx'
```

## Proposed Phased Implementation

1.  **Phase 1: Infrastructure.**
    *   Implement the dynamic language loading and `dir` attribute switching as described in `i18n-multi-language-support.md` and this document.
    *   Fix all hardcoded locales in utility functions.
    *   Add a temporary language switcher UI for developers.
2.  **Phase 2: Global Styles & Common Components.**
    *   Audit and refactor `global.css` for logical properties.
    *   Refactor the most common UI components in `components/ui/` (Button, Card, Input, Modal).
3.  **Phase 3: Full Codebase Sweep.**
    *   Go through every page and component, using the audit commands to find and replace all remaining physical properties with logical ones.
    *   Identify and handle all directional icons.
4.  **Phase 4: QA & Testing.**
    *   Perform a full manual QA pass of the entire application in an RTL language.
    *   Implement visual regression tests as described below.

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
