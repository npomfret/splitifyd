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

#### Recommended Strategy (Updated 2025-08-24)

**The Hybrid Approach:** Based on real-world experience with test brittleness during i18n implementation, the most robust strategy combines multiple selector approaches rather than relying solely on text-based selectors.

**Primary Strategy - Strategic Data-TestId Usage:**
- Add `data-testid` attributes to **critical elements** prone to text conflicts
- Focus on form inputs, action buttons, and complex sections
- Use semantic, descriptive IDs: `expense-amount-input`, `save-expense-button`

**Secondary Strategy - Enhanced Role-Based Selectors:**
- Use specific role selectors with name patterns: `getByRole('spinbutton', { name: /Amount\*/i })`
- Leverage accessibility attributes for stable element identification
- Maintain user experience testing principles

**Tertiary Strategy - Hierarchical Context:**
- Combine container selectors with element selectors for disambiguation
- Example: `page.locator('[data-testid="expense-form"]').getByLabel('Amount')`

**Translation Validation Strategy:**
- Limit text-based selectors to translation verification scenarios
- Use for confirming correct translations display, not primary functionality testing
- Force test environment to use English for consistent baseline testing

**Advantages of Hybrid Approach:**
-   **Eliminates Selector Conflicts:** Data-testid prevents "Amount" vs "Exact amounts" issues
-   **Reduces Maintenance:** Less dependency on changing UI text
-   **Maintains Accessibility Testing:** Role-based selectors validate user experience
-   **Flexible Implementation:** Choose appropriate selector type for each use case
-   **Future-Proof:** Stable foundation for continued i18n expansion

#### Previous Alternative (Now Partially Adopted)

The previously "not recommended" `data-testid` approach is now **strategically recommended** for critical elements, but with important caveats:

-   **Limited Scope:** Only add data-testid to elements that frequently cause conflicts
-   **Semantic IDs:** Use descriptive, meaningful test IDs that aid debugging
-   **Hybrid Usage:** Combine with role-based selectors for comprehensive testing
-   **Quality Assurance:** Ensures both functionality and accessibility validation

**Conclusion:** Real-world i18n implementation revealed that text-based selectors alone create unsustainable brittleness. The hybrid approach provides the stability needed for international expansion while maintaining testing best practices.

---

### Implementation Progress

## Frontend Internationalization: COMPLETED ✅

**Summary:** Complete frontend i18n implementation achieved across all user interface components (2025-08-22 to 2025-08-25).

**Key Achievements:**
- **Framework Integration:** `react-i18next` configured with comprehensive translation infrastructure
- **Component Coverage:** All 9 major UI categories fully internationalized (Authentication, Dashboard, Group Management, Expense Management, Settlement, Navigation, Settings, Error Handling)
- **Translation Keys:** 150+ hierarchically organized translation keys in `webapp-v2/src/locales/en/translation.json`
- **Test Infrastructure:** Hybrid testing strategy with strategic data-testid placement prevents selector brittleness
- **Quality Assurance:** TypeScript compilation, accessibility enhancements, production build verification completed
- **Pattern Establishment:** Proven methodology for systematic component conversion and translation key organization

**Production Ready:** All frontend components prepared for immediate multi-language deployment.

---

## Backend Internationalization: IN PROGRESS 🚧

**Started:** 2025-08-25

With frontend internationalization complete, implementation has begun on backend i18n to provide end-to-end language support including server-side validation, API errors, and future email/notification systems.

### Phase 1: Backend i18n Infrastructure Setup

**Goal:** Establish foundational backend internationalization infrastructure in Firebase Functions with user language preference system.

#### Implementation Tasks

**🚧 Task 1: Backend i18n Infrastructure Setup**
- Install `i18next` and Node.js i18n packages in Firebase Functions
- Create backend translation file structure (`firebase/functions/src/locales/`)
- Configure i18n initialization and middleware for request context
- Set up translation helper functions and error handling

**🚧 Task 2: User Language Preference System**
- Add `preferredLanguage` field to User model in shared types
- Update user profile endpoints to support language preference storage
- Implement language detection from `Accept-Language` headers
- Create middleware to extract and use user language for all API requests

**🚧 Task 3: API Validation Error Messages**  
- Replace Joi default error messages with i18n translation keys
- Create comprehensive validation message translation files
- Update all validation schemas across groups, expenses, auth modules
- Test localized error responses for all validation scenarios

**🚧 Task 4: Server-Side Error Internationalization**
- Internationalize ApiError responses in `utils/errors.ts`
- Update all custom error messages across Firebase Functions
- Create backend error message translation files by category
- Ensure proper error context and interpolation support
