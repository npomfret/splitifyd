# Transactional Email - Postmark Integration

## Overview

Implement transactional emails for authentication flows using Postmark as the email service provider.

## Current State

Password reset, welcome, and email verification emails are fully implemented with:
- `EmailTemplateService` - i18n-aware template generation with XSS protection
- `PostmarkEmailService` - REST API integration with message stream routing
- Translations in all 13 supported languages
- Unit tests and integration tests (Postmark sandbox)
- Welcome email sent automatically during registration (best-effort, non-blocking)
- Email verification available via POST /api/email-verification endpoint

## Remaining Emails

### 1. Email Change Confirmation

Sent when user changes their email address. May need to send to both old and new addresses.

**Content (to new address):**
- Verification link for new email
- Expiry notice
- Support contact

**Content (to old address - optional):**
- Notification that email was changed
- Security notice (contact support if not you)

**Trigger:** When user updates email in account settings

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

### Email Change Confirmation
- [ ] Add `email.emailChange.*` translation keys to all locale files
- [ ] Add `generateEmailChangeEmail()` method to `EmailTemplateService`
- [ ] Add unit tests for email change template
- [ ] Integrate into account settings email update flow
- [ ] Add integration test

## Technical Notes

- All emails use `EmailTemplateService` for consistent i18n and XSS protection
- All emails route through `PostmarkEmailService` with appropriate message stream
- Text and HTML versions generated for each email
- Translations follow existing pattern in `webapp-v2/src/locales/*/translation.json`
- Backend reads translations directly from locale files (whitelisted in `translation-keys.test.ts`)

## Files Reference

| File | Purpose |
|------|---------|
| `firebase/functions/src/services/email/EmailTemplateService.ts` | Template generation |
| `firebase/functions/src/services/email/PostmarkEmailService.ts` | Email sending |
| `firebase/functions/src/services/auth/IAuthService.ts` | Auth service interface (sendWelcomeEmail) |
| `firebase/functions/src/services/auth/FirebaseAuthService.ts` | Auth service implementation |
| `firebase/functions/src/auth/handlers.ts` | Registration handler with welcome email |
| `firebase/functions/src/__tests__/unit/services/email/EmailTemplateService.test.ts` | Unit tests |
| `firebase/functions/src/__tests__/integration/auth-and-registration.test.ts` | Integration tests |
| `webapp-v2/src/locales/*/translation.json` | i18n translations |
| `packages/test-support/src/__tests__/unit/translation-keys.test.ts` | Backend key whitelist |
