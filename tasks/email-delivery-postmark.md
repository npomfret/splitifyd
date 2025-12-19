# Transactional Email - Postmark Integration

## Overview

Implement transactional emails for authentication flows using Postmark as the email service provider.

## Current State

Password reset emails are fully implemented with:
- `EmailTemplateService` - i18n-aware template generation with XSS protection
- `PostmarkEmailService` - REST API integration with message stream routing
- Translations in all 13 supported languages
- Unit tests and integration test (Postmark sandbox)

## Remaining Emails

### 1. Welcome Email (after registration)

Sent immediately after successful user registration.

**Content:**
- Welcome message with app name
- Brief explanation of what they can do
- Link to get started (dashboard)
- Support contact

**Trigger:** `FirebaseAuthService` or registration handler after user creation

### 2. Email Verification (confirm your email address)

Sent to verify email ownership. Uses Firebase's email verification flow.

**Content:**
- Request to verify email
- Verification link (Firebase action URL with oobCode)
- Expiry notice
- Ignore notice if not requested
- Support contact

**Trigger:** After registration OR when user requests verification resend

### 3. Email Change Confirmation

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

### Welcome Email
- [ ] Add `email.welcome.*` translation keys to all locale files
- [ ] Add `generateWelcomeEmail()` method to `EmailTemplateService`
- [ ] Add unit tests for welcome email template
- [ ] Integrate into registration flow
- [ ] Add integration test

### Email Verification
- [ ] Add `email.verification.*` translation keys to all locale files
- [ ] Add `generateEmailVerificationEmail()` method to `EmailTemplateService`
- [ ] Add unit tests for verification email template
- [ ] Implement send verification endpoint (or integrate with Firebase email verification)
- [ ] Add integration test

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
| `firebase/functions/src/__tests__/unit/services/email/EmailTemplateService.test.ts` | Unit tests |
| `webapp-v2/src/locales/*/translation.json` | i18n translations |
| `packages/test-support/src/__tests__/unit/translation-keys.test.ts` | Backend key whitelist |
