## Task: High-Level Plan for Internationalization (i18n) and Localization (l10n)

**Goal:**
Prepare the entire application codebase to support multiple languages, enabling future translation and localization efforts.

**Justification:**
To expand our user base globally, the app must be able to display all text and content in the user's native language. This task outlines the foundational work required to make the app translatable.

---

### High-Level Considerations

This is a high-level overview of the areas and concepts we need to address. A detailed technical analysis will be required for each point.

#### 1. String Externalization (The Core Task)

- **Concept:** No user-facing text should be hardcoded directly in the source code. Every string (e.g., "Add Expense", "Welcome back!", "Your email is invalid") must be moved into separate language resource files (e.g., JSON files).
- **Action:** A full audit of the codebase is needed to find and replace all hardcoded strings with a key that references an entry in a language file.

#### 2. Choosing an i18n Framework

- **Concept:** We need to select and integrate a dedicated library to manage the complexities of translation.
- **Considerations:** The framework should handle:
    - Loading the correct language files.
    - Looking up translation keys.
    - **Pluralization:** Handling different strings for singular vs. plural counts (e.g., "1 item" vs. "5 items"), which varies by language.
    - **Interpolation:** Injecting dynamic values into strings (e.g., `Hello, {username}!`).
- **Examples:** `react-i18next`, `i18next`, `FormatJS (React Intl)`.

#### 3. Key Areas for String Extraction

We need to audit the following areas across the entire project (both frontend and backend):

- **Frontend (WebApp):**
    - All UI components (buttons, labels, titles, tooltips, placeholders).
    - Static page content.
    - Form validation messages.
    - Client-side error messages and toasts/notifications.
- **Backend (Firebase Functions):**
    - API error messages returned to the client.
    - Email templates (e.g., welcome emails, password resets).
    - Push notifications.

#### 4. Handling Localized Formatting

- **Concept:** Internationalization is more than just translating text. Different regions have different conventions.
- **Considerations:**
    - **Dates & Times:** `MM/DD/YYYY` (US) vs. `DD/MM/YYYY` (Europe).
    - **Numbers & Currency:** `1,000.50` (US) vs. `1.000,50` (Germany). Currency symbols also change position.
    - The chosen i18n library should provide utilities for this, or we can use native browser APIs (`Intl` object).

#### 5. Right-to-Left (RTL) Language Support

- **Concept:** Some languages, like Arabic and Hebrew, are read from right to left. This requires the entire UI layout to be mirrored.
- **Considerations:** This is a significant effort. We need to ensure our CSS is structured in a way that supports RTL layouts, often by using logical properties (e.g., `margin-inline-start` instead of `margin-left`).

#### 6. Asset Localization

- **Concept:** Some images, videos, or downloadable documents may contain text. These assets will also need to be localized.
- **Action:** We need to identify all such assets and plan a system for serving the correct version based on the user's selected language.

#### 7. Language Selection Mechanism

- **Concept:** How will the application determine which language to display?
- **Options to consider:**
    1.  Detecting the user's browser language settings (`Accept-Language` header).
    2.  Providing an explicit language switcher in the app's UI.
    3.  Saving the user's preference in their profile.
    - A combination of these is usually the best approach.

---

### Impact on Testing & Recommendations

Introducing i18n will directly impact the E2E test suite, as tests currently rely on user-facing text for element selection (e.g., `getByText('Add Expense')`). When this text is translated, these tests will fail.

#### Recommended Strategy

The primary goal of the E2E suite is to test application **functionality**, not translation accuracy. Therefore, the most robust and maintainable strategy is to **force the test environment to always run in a single, default language (e.g., English).**

-   **Implementation:** The i18n library will be configured in the Playwright test setup to always use the English language pack.
-   **Advantages:**
    -   **No Test Code Changes:** Existing and future tests can continue to use text-based selectors without modification.
    -   **Stability:** The test suite is completely decoupled from the translation process. Adding or changing translations will not break functional tests.
    -   **Speed:** Avoids the immense overhead of running the entire test suite for every supported language.

#### Alternative (Not Recommended)

An alternative is to replace all text-based selectors with a stable, non-translated attribute like `data-testid`.

-   **Example:** Change `getByText('Add Expense')` to `getByTestId('add-expense-button')`.
-   **Why We Should Avoid This:** This approach is not recommended because it pollutes the production code with test-specific attributes and moves away from the best practice of testing the application as a user sees it, a principle established in the project's `end-to-end_testing.md` guide.

**Conclusion:** By ensuring our functional tests always run against a single language, we can proceed with internationalization without compromising the stability or maintainability of our test suite. Testing the translations themselves can be handled as a separate, future quality assurance task.

---

### Implementation Progress

**Date:** 2025-08-22

The initial, minimal implementation has been completed. This work serves as the foundation for all future i18n development.

-   **Framework:** `react-i18next` and `i18next` have been installed and configured in the `webapp-v2` package.
-   **Configuration:**
    -   A configuration file has been created at `webapp-v2/src/i18n.ts`.
    -   The framework has been initialized in the application entry point, `webapp-v2/src/main.tsx`.
-   **Language Files:**
    -   The directory structure for translations has been established at `webapp-v2/src/locales/`.
    -   The first English translation file has been created at `webapp-v2/src/locales/en/translation.json`.
-   **Proof of Concept:**
    -   The `CreateGroupModal.tsx` component has been fully refactored to use the i18n system.
    -   All hardcoded text, including labels, placeholders, help text, buttons, and validation messages, has been externalized into the `translation.json` file.
    -   This component now serves as a template for how to refactor other components.
-   **Further Progress:**
    -   The `LoginPage.tsx` and `RegisterPage.tsx` components have been fully refactored to use the i18n system.

**Date:** 2025-08-23

Significant progress has been made on test suite i18n integration and component accessibility improvements:

#### Test Suite i18n Integration
-   **Strategy Validation:** The recommended approach of forcing tests to run in a single language (English) has been successfully implemented and validated.
-   **E2E Test Framework Updates:**
    -   Created comprehensive translation constants in `e2e-tests/src/constants/selectors.ts` that import from the main translation file.
    -   Updated test page objects to use translation keys instead of hardcoded strings.
    -   Fixed selector conflicts and ambiguous element matching issues.
-   **Translation File Expansion:**
    -   Added comprehensive translation keys for expense forms, settlement forms, common UI elements, and error messages.
    -   Organized translations into logical sections: `loginPage`, `registerPage`, `createGroupModal`, `expenseForm`, `settlementForm`, `common`, and `errors`.

#### Component Accessibility & Quality Improvements
-   **Form Input Components:**
    -   Enhanced `PasswordInput` component with configurable `id` prop to prevent duplicate HTML IDs.
    -   Fixed accessibility issues with proper `for`/`id` label associations.
    -   Improved `aria-label` and `aria-describedby` attribute usage.
-   **RegisterPage Refactoring:**
    -   Added proper accessibility attributes to name input field.
    -   Fixed duplicate password input IDs using unique identifiers.
    -   Ensured all form elements have proper label associations.

#### Critical Issues Resolved
-   **i18n Initialization Bug:** Fixed missing i18n import in `main.tsx` that was causing translation keys to display instead of translated text.
-   **Test Selector Brittleness:** Resolved numerous test failures caused by hardcoded text selectors that didn't match the actual UI.
-   **HTML Validation Issues:** Fixed duplicate IDs and improved semantic HTML structure.

#### Test Suite Stability
-   **Consistent Test Passes:** Both expense creation and authentication navigation test suites now pass consistently (20+ consecutive successful runs).
-   **Robust Selectors:** Tests now use translation-based selectors that are resilient to UI text changes.
-   **Better Error Messages:** Improved test debugging with more specific element selection strategies.

#### Key Learnings
1. **i18n Integration is Critical for Test Stability:** The disconnect between translated UI and hardcoded test selectors was a major source of test brittleness.
2. **Accessibility and i18n Go Hand-in-Hand:** Proper form labeling and element identification are essential for both screen readers and test automation.
3. **Component API Design Matters:** Components need flexible APIs (like configurable IDs) to work well in different contexts and avoid HTML validation issues.
4. **Test-First Approach Works:** Using translation keys in tests from the beginning would prevent many of these issues.

#### Preventing E2E Test Breakage During i18n Implementation

To maintain test stability when implementing i18n across components, follow these critical prevention guidelines:

**1. Translation-Based Test Selectors**
- Import translation file in test constants: `import translation from '../../../webapp-v2/src/locales/en/translation.json'`
- Use translation keys in selectors: `translation.createGroupModal.title` instead of hardcoded `"Create New Group"`
- Update `e2e-tests/src/constants/selectors.ts` to reference translation keys

**2. Component i18n Implementation Pattern**
- Add `useTranslation()` hook: `const { t } = useTranslation();`
- Replace hardcoded strings: `"Create New Group"` → `{t('createGroupModal.title')}`
- Ensure translation keys match exactly between component and test selectors
- Test manually after each component conversion to verify text displays correctly

**3. Accessibility and DOM Validation**
- Use unique IDs for form elements to prevent duplicate ID warnings
- Add configurable `id` props to reusable components like `PasswordInput`
- Ensure proper `for`/`id` label associations for form accessibility
- Use specific selectors to avoid ambiguity (e.g., `getByLabel('Password').and(locator('input'))`)

**4. Translation File Organization**
- Structure keys hierarchically: `registerPage.fullNameLabel`, `common.loading`
- Keep translation keys descriptive and component-specific
- Add comprehensive keys for forms, validation messages, and common UI elements
- Validate JSON structure after updates

**5. Test Update Sequence**
- Update translation file with new keys first
- Update component to use translation keys
- Update test selectors to use translation-based constants
- Run tests to verify no breakage before proceeding to next component

**6. Debugging Failed Tests**
- Check for selector ambiguity (multiple elements matching the same text)
- Verify translation keys exist in translation file
- Ensure i18n is properly initialized in `main.tsx`
- Use browser dev tools to inspect actual rendered text vs expected selectors

Following these guidelines prevents the brittleness that caused 20+ test failures during initial implementation.

#### Next Steps
The foundation is now solid for continuing i18n rollout across the remaining components. The established patterns and resolved issues provide a clear template for future work.
