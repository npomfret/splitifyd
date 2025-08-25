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

      i18n
        .use(HttpApi)
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
- Test the user journey for a new user, ensuring the browser's language is detected correctly on the first visit.
