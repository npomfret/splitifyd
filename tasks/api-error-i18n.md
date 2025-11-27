# API Error Message Internationalization

API error messages (e.g., "Authentication required", "Access denied", "Group not found") are hardcoded in English in `firebase/functions/src/utils/errors.ts` and throughout the backend.

These messages are displayed directly to users in the frontend UI.

**Problem:** Users in non-English locales see English error messages.

**Scope:** Determine strategy for translating API error messages to support i18n.
