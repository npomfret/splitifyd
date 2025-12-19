# Transactional Email - Postmark Integration

## Overview

Implement transactional emails for authentication flows using Postmark as the email service provider.

## Current State

All transactional authentication emails are fully implemented:
- `EmailTemplateService` - i18n-aware template generation with XSS protection
- `PostmarkEmailService` - REST API integration with message stream routing
- Translations in all 13 supported languages
- Unit tests and integration tests (Postmark sandbox)
- Welcome email sent automatically during registration (best-effort, non-blocking)
- Email verification available via POST /api/email-verification endpoint
- Email change verification sends link to NEW email address; Firebase handles the actual change when user clicks

## Implementation Checklist

### Welcome Email ✅
- [x] Add `email.welcome.*` translation keys to all locale files
- [x] Add `generateWelcomeEmail()` method to `EmailTemplateService`
- [x] Add unit tests for welcome email template
- [x] Integrate into registration flow (via `AuthHandlers.register`)
- [x] Add integration test

### Email Verification ✅
- [x] Add `email.verification.*` translation keys to all locale files
- [x] Add `generateEmailVerificationEmail()` method to `EmailTemplateService`
- [x] Add unit tests for verification email template
- [x] Implement `sendEmailVerification()` in AuthService with API endpoint
- [x] Add integration test

### Email Change Confirmation ✅
- [x] Add `email.emailChange.*` translation keys to all locale files
- [x] Add `generateEmailChangeEmail()` method to `EmailTemplateService`
- [x] Add unit tests for email change template (17 tests)
- [x] Add `sendEmailChangeVerification()` to IAuthService/FirebaseAuthService
- [x] Integrate into account settings email update flow (UserHandlers.changeEmail)
- [x] Add integration test

## Technical Notes

- All emails use `EmailTemplateService` for consistent i18n and XSS protection
- All emails route through `PostmarkEmailService` with appropriate message stream
- Text and HTML versions generated for each email
- Translations follow existing pattern in `webapp-v2/src/locales/*/translation.json`
- Backend reads translations directly from locale files (whitelisted in `translation-keys.test.ts`)

### Email Change Flow
The email change flow works as follows:
1. User requests email change via PUT /api/users/me/email with currentPassword and newEmail
2. Backend validates password and calls `validateEmailChange()` (does NOT change email yet)
3. Backend sends verification email to the NEW email address using Firebase's `generateVerifyAndChangeEmailLink`
4. User clicks link in email → Firebase verifies and changes the email
5. Email is only changed after user clicks the verification link

## Files Reference

| File | Purpose |
|------|---------|
| `firebase/functions/src/services/email/EmailTemplateService.ts` | Template generation |
| `firebase/functions/src/services/email/PostmarkEmailService.ts` | Email sending |
| `firebase/functions/src/services/auth/IAuthService.ts` | Auth service interface |
| `firebase/functions/src/services/auth/FirebaseAuthService.ts` | Auth service implementation |
| `firebase/functions/src/auth/handlers.ts` | Registration handler with welcome email |
| `firebase/functions/src/user/UserHandlers.ts` | Email change handler |
| `firebase/functions/src/services/UserService2.ts` | User service with validateEmailChange |
| `firebase/functions/src/__tests__/unit/services/email/EmailTemplateService.test.ts` | Unit tests |
| `firebase/functions/src/__tests__/unit/api/users.test.ts` | User API unit tests |
| `firebase/functions/src/__tests__/integration/auth-and-registration.test.ts` | Integration tests |
| `webapp-v2/src/locales/*/translation.json` | i18n translations |
| `packages/test-support/src/__tests__/unit/translation-keys.test.ts` | Backend key whitelist |
| `packages/test-support/src/builders/EmailChangeEmailVariablesBuilder.ts` | Test builder |
