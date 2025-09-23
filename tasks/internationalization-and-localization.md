# Feature: Internationalization and Localization (i18n)

## 1. Overview

This document provides a deep dive into the current state of internationalization (i18n) in the project and outlines a comprehensive plan to build a robust, scalable, and production-grade localization system. The goal is to enable the application to support multiple languages seamlessly across both the frontend and backend, providing a native experience for all users.

## 2. Research & Best Practices

A review of industry best practices for i18n in a React/Firebase environment confirms the following standards:

- **Use `i18next`:** The combination of `i18next`, `react-i18next`, and `i18next-fs-backend` (for Node.js) is the de-facto standard for modern web applications.
- **Store User Preference:** A user's selected language should be stored in their Firestore user profile. This allows the preference to be synced across devices and be accessible by backend Firebase Functions for sending localized emails or API messages.
- **Dynamic Translation Loading:** The frontend should not bundle all languages into the initial download. Translations should be loaded on-demand (`lazy-loaded`) as needed to keep the initial bundle size small and performance high.
- **Backend Translations:** The backend must have its own i18n instance to handle translating content that originates from the server, such as API error messages, validation errors, and transactional emails.

## 3. Current Implementation Analysis

### Frontend (`webapp-v2`)

- **Status:** A basic implementation exists.
- **Libraries:** Correctly uses `i18next` and `react-i18next`.
- **Strengths:**
    - Translation files are well-structured by feature (e.g., `loginPage`, `createGroupModal`).
- **Gaps & Weaknesses:**
    1.  **Hardcoded Language:** The language is hardcoded to English (`lng: 'en'`) in `i18n.ts` and does not detect the user's browser preference.
    2.  **No Dynamic Loading:** All translations are imported directly and bundled into the main application, which will increase initial load times as more languages are added.
    3.  **No UI for Language Switching:** Users have no way to select their preferred language.

### Backend (`firebase/functions`)

- **Status:** A partial implementation exists.
- **Libraries:** Correctly uses `i18next` and `i18next-fs-backend`.
- **Strengths:**
    - A robust system is in place to translate Joi validation errors (`utils/i18n-validation.ts`).
    - An Express middleware (`i18nMiddleware`) is implemented to integrate i18n into the request lifecycle.
- **Gaps & Weaknesses:**
    1.  **Missing Translation Files:** The backend is configured to load translations from `firebase/functions/locales`, but this directory and the corresponding JSON files do not exist. The system is non-operational.
    2.  **Disconnected from User Preference:** The system defaults to English and has no mechanism to know which language the current user prefers.

## 4. Proposed Implementation Plan

This plan will bridge the identified gaps and deliver a complete i18n system.

### Phase 1: Foundational Backend and Data Model

1.  **Update User Schema:**
    - Add a `language` field to the user profile document in Firestore (`/users/{userId}`).
    - This will be the single source of truth for a user's language preference. It should default to `'en'`.

2.  **Create Backend Translation Files:**
    - Create the directory `firebase/functions/src/locales/en`.
    - Create a `translation.json` file inside with relevant backend error messages. Start with the validation messages from `utils/i18n-validation.ts`.
    - **Example `firebase/functions/src/locales/en/translation.json`:**
        ```json
        {
            "errors": {
                "server": {
                    "internalError": "An unexpected server error occurred."
                },
                "validation": {
                    "string": {
                        "base": "This field must be text.",
                        "min": "This field must be at least {{limit}} characters long.",
                        "max": "This field must be no more than {{limit}} characters long.",
                        "email": "A valid email address is required."
                    },
                    "any": {
                        "required": "This field is required."
                    }
                }
            }
        }
        ```

3.  **Update Backend `i18nMiddleware`:**
    - Modify the middleware to fetch the logged-in user's profile, read their `language` preference, and set it for the duration of the request.
    - This will ensure that API error messages are translated according to the user's setting.

### Phase 2: Frontend Enhancements

1.  **Implement Language Switcher UI:**
    - Create a new `LanguageSwitcher` component.
    - This component will be a simple dropdown menu displaying the list of supported languages.
    - Place this component in a logical location, such as the `SettingsPage.tsx` or within the `UserMenu`.
    - When a user selects a new language, the component will:
      a. Call a new method in the `AuthStore` (e.g., `updateLanguagePreference(lang)`) to update the `language` field in their Firestore user document.
      b. Call `i18n.changeLanguage(lang)` to change the frontend's language in real-time.

2.  **Refactor Frontend `i18n.ts` for Dynamic Loading:**
    - Update `webapp-v2/src/i18n.ts` to use `i18next-http-backend` and `i18next-browser-languagedetector`.
    - This will stop bundling all translations and instead load them from the `/locales` directory on demand. It will also auto-detect the user's language on their first visit.
    - **Example `webapp-v2/src/i18n.ts`:**

        ```typescript
        import i18n from 'i18next';
        import { initReactI18next } from 'react-i18next';
        import HttpApi from 'i18next-http-backend';
        import LanguageDetector from 'i18next-browser-languagedetector';

        i18n.use(HttpApi)
            .use(LanguageDetector)
            .use(initReactI18next)
            .init({
                supportedLngs: ['en', 'es'], // Add new languages here
                fallbackLng: 'en',
                debug: process.env.NODE_ENV === 'development',
                interpolation: {
                    escapeValue: false, // React already escapes
                },
                backend: {
                    loadPath: '/locales/{{lng}}/translation.json',
                },
                react: {
                    useSuspense: true, // Recommended for lazy loading
                },
            });

        export default i18n;
        ```

### Phase 3: Add a New Language (Spanish)

1.  **Frontend:**
    - Create a new translation file: `webapp-v2/public/locales/es/translation.json`.
    - Populate this file with Spanish translations for the keys found in the English version.
    - Add `'es'` to the `supportedLngs` array in `webapp-v2/src/i18n.ts`.

2.  **Backend:**
    - Create a new translation file: `firebase/functions/src/locales/es/translation.json`.
    - Populate this file with Spanish translations for the backend error messages.

### Phase 4: Verification

- Manually test the language switcher. Verify the language changes immediately on the frontend and that the preference is saved to the user's Firestore document.
- Trigger a backend validation error and verify that the error message is returned in the selected language.
- Test the user journey for a new user, ainsuring the browser's language is detected correctly on the first visit.

## 5. Hardcoded Text Audit

The following is a list of hardcoded text found in the `webapp-v2` `.tsx` files that needs to be internationalized.

### `/src/components/auth/EmailInput.tsx`
- "Enter your email" (placeholder)

### `/src/components/auth/PasswordInput.tsx`
- "Enter your password" (placeholder)
- "Password" (label)

### `/src/components/comments/CommentInput.tsx`
- "Comment text" (aria-label)
- "Send comment" (aria-label)

### `/src/components/comments/CommentItem.tsx`
- "just now"

### `/src/components/dashboard/GroupCard.tsx`
- "You're owed "
- "You owe "

### `/src/components/expense-form/ExpenseBasicFields.tsx`
- "*" (required indicator)
- "0.00" (placeholder)

### `/src/components/expense-form/PayerSelector.tsx`
- "Who paid?"
- "*" (required indicator)

### `/src/components/expense-form/SplitAmountInputs.tsx`
- "Enter exact amounts for each person:"
- "Unknown"
- "Total:"
- "Enter percentage for each person:"
- "%"
- "Each person pays:"

### `/src/components/expense-form/SplitTypeSelector.tsx`
- "How to split"
- "Equal"
- "Exact amounts"
- "Percentage"

### `/src/components/expense/ExpenseActions.tsx`
- "Edit"
- "Copy expense" (ariaLabel)
- "Copy"
- "Share"
- "Delete"
- "Failed to delete expense"

### `/src/components/expense/SplitBreakdown.tsx`
- "Split Equally"
- "Exact Amounts"
- "By Percentage"
- "Custom Split"
- "Split between {expense.participants.length} {expense.participants.length === 1 ? 'person' : 'people'}"
- "Unknown"
- "Paid"
- "Owes {memberMap[expense.paidBy]?.displayName || 'Unknown'}"
- "Total: {expense.splits.reduce((sum, s) => sum + (s.amount / expense.amount) * 100, 0).toFixed(1)}%"

### `/src/components/group/BalanceSummary.tsx`
- "Unknown"

### `/src/components/group/EditGroupModal.tsx`
- "⚠️"

### `/src/components/group/ExpenseItem.tsx`
- "Unknown"

### `/src/components/group/MembersList.tsx`
- "Unknown User"

### `/src/components/group/MembersListWithManagement.tsx`
- "User"

### `/src/components/join-group/GroupPreview.tsx`
- "Member" / "Members"
- "Active"
- "Group"
- "You've been invited to join this group"

### `/src/components/join-group/MembersPreview.tsx`
- "Group Size"
- "member" / "members"

### `/src/components/landing/CTASection.tsx`
- "Ready to Simplify Your Shared Expenses?"
- "Join thousands who are already making group payments stress-free and transparent. Get started today!"
- "Sign Up for Free"

### `/src/components/landing/FeaturesGrid.tsx`
- "Smart Group Management"
- "Create groups for any occasion. Easily add members and track shared expenses in one place, keeping everyone on the same page."
- "Flexible Splitting"
- "Split bills equally, by exact amounts, or by percentages. We handle all the complex math, so you don't have to."
- "Debt Simplification"
- "Our algorithm minimizes transactions, showing you the simplest way to settle up, saving everyone time and hassle."
- "100% Free to Use"
- "Our service is and always will be free. No hidden fees or premium tiers—just a powerful, accessible tool for everyone."
- "Unlimited Use"
- "Create as many groups, add as many friends, and track as many expenses as you need. No restrictions, no limits."
- "Zero Ads, Ever"
- "Enjoy a clean, focused experience. We will never sell your data or clutter your screen with ads. Your privacy is our priority."
- "Everything You Need, Nothing You Don't"

### `/src/components/landing/Globe.tsx`
- "Unable to load 3D globe"

### `/src/components/landing/HeroSection.tsx`
- "Effortless Bill Splitting,
Simplified & Smart."
- "Say goodbye to awkward IOUs and complex calculations. Our app makes sharing expenses with friends, family, and roommates easy, fair, and transparent. It's 100% free, with no ads and no limits. Focus on what matters, not on the math."
- "Splitifyd App Screenshot" (alt text)

### `/src/components/layout/Header.tsx`
- "..." (fallback)

### `/src/components/policy/PolicyAcceptanceModal.tsx`
- "Accept Updated Policies"
- "Policy {currentPolicyIndex + 1} of {policies.length}: {currentPolicy.policyName}"
- "Progress"
- "{acceptedPolicies.size} of {policies.length} accepted"
- "✓ Accepted"
- "Loading policy content..."
- "Policy Acceptance Required"
- "Please read the policy above and click "Accept" to continue using Splitify."
- "I have read and accept this {currentPolicy.policyName.toLowerCase()}"
- "Previous"
- "Next"
- "Accepting..."
- "Accept All & Continue"
- "Failed to load policy content: {err instanceof Error ? err.message : 'Unknown error'}"
- "Failed to accept policies: {err instanceof Error ? err.message : 'Unknown error'}"

### `/src/components/settlements/SettlementForm.tsx`
- "Unknown User"

### `/src/components/ui/Alert.tsx`
- "Dismiss alert"

### `/src/components/ui/Button.tsx`
- "Button"

### `/src/components/ui/ConfirmDialog.tsx`
- "Confirm"
- "Cancel"

### `/src/components/ui/CurrencyAmountInput.tsx`
- "?"
- "Search currencies"

### `/src/components/ui/CurrencySelector.tsx`
- "Select currency..."
- "*"
- "Search currencies..."
- "No currencies found"
- "Recent"
- "Common"
- "All Currencies"

### `/src/components/ui/Input.tsx`
- "*"

### `/src/pages/JoinGroupPage.tsx`
- "Loading..."

### `/src/pages/LandingPage.tsx`
- "Say goodbye to awkward IOUs and complex calculations. Our app makes sharing expenses with friends, family, and roommates easy, fair, and transparent. It's 100% free, with no ads and no limits."
- "This is a tool for tracking expenses, not for making payments. To save and manage your expenses, you'll need a free account. We will never ask for sensitive financial details."

### `/src/pages/static/CookiePolicyPage.tsx`
- "Cookie Policy"
- "Cookie Policy for Splitifyd - Learn about how we use cookies and similar technologies."
- "Last updated: "
- "Error loading cookie policy"

### `/src/pages/static/PricingPage.tsx`
- "Pricing (It's Free, Seriously)"
- "Simple, transparent pricing for Splitifyd. Split bills with friends for free."
- "Choose Your Adventure"
- "The "Just Getting Started" Plan"
- "The "I'm Basically a Pro" Plan"
- "The "I'm a Philanthropist" Plan"
- "Unlimited expense tracking"
- "Unlimited groups"
- "Unlimited friends (if you have that many)"
- "Basic debt simplification"
- "Access to our highly sarcastic FAQ section"
- "Sign Up (It's Still Free)"
- "MOST POPULAR"
- "Everything in "Just Getting Started""
- "Advanced debt simplification (it's the same, but sounds cooler)"
- "Priority access to our "we'll get to it when we get to it" support"
- "The warm fuzzy feeling of not paying for anything"
- "Bragging rights to your friends about your free app"
- "Join Now (Seriously, No Catch)"
- "Everything in "I'm Basically a Pro""
- "The ability to tell people you're on the "Philanthropist" plan"
- "A deep sense of satisfaction from using a free app"
- "We'll send you good vibes (results may vary)"
- "Your name will be whispered in the halls of free software fame"
- "Get Started (It's a Gift!)"
- "Disclaimer: All plans are, and always will be, absolutely free. We just like making fancy tables. No hidden fees, no premium features, no secret handshake required. Just pure, unadulterated free expense splitting. You're welcome."

### `/src/pages/static/PrivacyPolicyPage.tsx`
- "Privacy Policy"
- "Privacy Policy for Splitifyd - Learn about how we collect, use, and protect your information."
- "Last updated: "
- "Error loading privacy policy"

### `/src/pages/static/TermsOfServicePage.tsx`
- "Terms of Service"
- "Terms of Service for Splitifyd - Read about our policies and user agreements."
- "Last updated: "
- "Error loading terms"