# Email Delivery Service - Postmark Integration

## Overview

Implement email delivery using Postmark (https://postmarkapp.com) as the transactional email service. The **Postmark REST API** will be the primary integration method due to its richer feature set and better error handling capabilities.

## Why Postmark

- High deliverability rates
- Dedicated IP pools for transactional email
- Real-time analytics and bounce handling
- Simple REST API
- Webhook support for delivery events

## Requirements

- [x] Send transactional emails (password reset, email verification, etc.) - password reset implemented
- [ ] Send notification emails (group invites, expense notifications, etc.)
- [ ] Handle bounces and complaints
- [ ] Track delivery status
- [x] Support email templates - i18n EmailTemplateService with XSS protection

## Research Needed

- Postmark API documentation
- Server token vs account token usage
- Template system capabilities
- Webhook event types
- Rate limits and pricing tiers

## Technical Considerations

- Service abstraction layer (to allow swapping providers)
- Configuration via environment variables
- Error handling and retry logic
- Email queue for high-volume scenarios
- Development/testing without sending real emails

## Decisions (Secrets + Config)

- **Secrets store:** Google Secret Manager (GCP).
- **Secret strategy:** one single JSON secret map (recommended by Firebase Functions for Secrets, keeps names static).
  - Secret name (proposed): `POSTMARK_API_KEYS_JSON`
  - Value: JSON object mapping our logical `__POSTMARK_SERVERNAME` ➜ Postmark server token.
    - Example: `{ "sidebadger-me-blackhole": "POSTMARK_SERVER_TOKEN", "prod": "POSTMARK_SERVER_TOKEN" }`
- **Env convention:** each Firebase instance `.env.instance*` provides `__POSTMARK_SERVERNAME=<postmarkServerName>` (the app uses this logical key to select from the JSON secret map).
- **Current configured Postmark servername:** `sidebadger-me-blackhole` (sandbox/blackhole server; no real deliveries).
- **Password reset UX:** App-hosted reset page using Firebase's standard action handler path (`/__/auth/action`) on our tenant domain.

## Secrets Management (Firebase Best Practice)

- Prefer Firebase Functions Secrets integration (`defineSecret()` + function `secrets: [...]`) rather than calling Secret Manager at runtime.
- Because `defineSecret()` requires static secret names known at deploy time, use `POSTMARK_API_KEYS_JSON` (a JSON map) and select the token via `__POSTMARK_SERVERNAME` at runtime.
- Emulator: override secrets via `.secret.local` when needed (otherwise the emulator may try to access deployed secrets).

## Plan (Incremental)

### Phase 1: Secrets + Instance Config (small)

- [x] Choose single JSON secret map (`POSTMARK_API_KEYS_JSON`)
- [x] Define env convention: `.env.instance*` contains `__POSTMARK_SERVERNAME=<postmarkServerName>`
- [ ] Create/set Secret Manager secret `POSTMARK_API_KEYS_JSON` (via Firebase CLI `firebase functions:secrets:set POSTMARK_API_KEYS_JSON --format=json`).
- [ ] Decide how instance selection affects secrets: demo/prod/staging mapping and whether each uses distinct projects or distinct secret values

### Phase 2: Backend Email Abstraction (medium)

- [x] Add `IEmailService` interface in `firebase/functions/src/services/email/IEmailService.ts`
- [x] Add `FakeEmailService` for unit tests
- [x] Add `PostmarkEmailService` (REST API) reading token from `POSTMARK_API_KEYS_JSON`
- [x] Wire `IEmailService` in `firebase/functions/src/services/ComponentBuilder.ts` (Fake in unit tests, Postmark otherwise)

### Phase 3: Sending + Observability (medium)

- [x] Integrate `IEmailService` into the first real email use-case (password reset via FirebaseAuthService)
- [x] Add `EmailTemplateService` with i18n support (loads translations from webapp locales)
- [x] Add `messageStream` field to route emails through correct Postmark stream
- [x] Add success logging with Postmark MessageID for delivery tracking
- [x] Add integration test exercising password reset email via Postmark sandbox
- [x] Add unit tests for EmailTemplateService (XSS escaping, interpolation, caching, fallback)
- [ ] Add delivery event tracking hooks (webhook ingestion) and persistence strategy (TBD)

### Password Reset Implementation Notes

- Reset link in email targets the tenant domain using Firebase's standard action handler path:
  - `https://<tenant-domain>/__/auth/action?mode=resetPassword&oobCode=<code>`
- Webapp implements the confirm flow at `/__/auth/action` using Firebase client SDK (`verifyPasswordResetCode` + `confirmPasswordReset`)

## Implementation Plan (REST API Focused)

The primary integration method will be the Postmark REST API, focusing on a robust, testable, and secure abstraction.

**Core Abstraction Strategy:**

1.  **Define `IEmailService` Interface:**
    *   Create `firebase/functions/src/services/email/IEmailService.ts`.
    *   This interface will define the contract for sending emails (e.g., `sendEmail(to: string, subject: string, body: string)`).

2.  **Implement `PostmarkEmailService`:**
    *   Create `firebase/functions/src/services/email/PostmarkEmailService.ts`.
    *   This class will implement `IEmailService` and use the `postmark` npm package to interact with the Postmark REST API.
    *   It will receive the Postmark API token via its constructor, which the `postmark` client library will then use in the `X-Postmark-Server-Token` header.

3.  **Implement `FakeEmailService` for Unit Testing:**
    *   Create `firebase/functions/src/services/email/FakeEmailService.ts`.
    *   This class will also implement `IEmailService`.
    *   Instead of sending real emails, it will store the `Email` objects in an in-memory array, allowing unit tests to assert that emails were "sent" with the correct content.

4.  **Secret Management (Google Secret Manager):**
    *   Use Firebase Functions secrets integration so the runtime does not manually call Secret Manager.
    *   Define a single secret via `defineSecret('POSTMARK_API_KEYS_JSON')`.
    *   Bind the secret to the functions that need it using `secrets: [POSTMARK_API_KEYS_JSON]`.
    *   Access via `POSTMARK_API_KEYS_JSON.value()` (auto-parses JSON when `--format=json` is used when setting the secret).
    *   Select the correct token by `__POSTMARK_SERVERNAME` from instance config.
    *   **Caching:** keep the parsed JSON and the selected token in memory for the life of the function instance, and implement “single-flight” initialization to avoid concurrent parsing/selection while one is in-flight.
    *   **Local emulation:** override via `.secret.local` when needed; otherwise emulator may try to access deployed secrets.

5.  **Emulator Configuration ("Blackhole" for Integration Tests):**
    *   When running the Firebase emulator for integration testing (where email sending logic needs to be exercised), the `PostmarkEmailService` will be instantiated with the `POSTMARK_API_TEST` token.
    *   This `POSTMARK_API_TEST` token, passed as the `X-Postmark-Server-Token`, directs all emails to a "blackhole" where they are processed by Postmark but not actually delivered, preventing unintended email sends during testing.

6.  **Dependency Injection Setup (`ComponentBuilder.ts`):**
    *   Modify `firebase/functions/src/services/ComponentBuilder.ts` to manage the lifecycle of `IEmailService`.
    *   The `buildEmailService()` method in `ComponentBuilder` will decide which implementation to return based on the execution context:
        *   If running in a test environment (e.g., `process.env.NODE_ENV === 'test'`), provide `FakeEmailService`.
        *   Otherwise, fetch the Postmark API token from Google Secret Manager and provide `PostmarkEmailService`.
        *   The fetched token will determine if it's a real Postmark send or a "blackhole" send for emulator integration tests.

7.  **Service Integration:**
    *   Any service that needs to send emails will receive `IEmailService` via constructor injection (e.g., `constructor(private readonly emailService: IEmailService)`).

8.  **Testing Setup (`AppDriver.ts`):**
    *   Modify `firebase/functions/src/__tests__/unit/AppDriver.ts` (and potentially integration test setup) to configure the environment correctly, ensuring that `FakeEmailService` is used for unit tests and the "blackhole" `PostmarkEmailService` is used for emulator integration tests.

**Action Items:**

*   **[In-Progress] Configure Environment & Secrets:**
    *   **DONE:** We have a sandbox/blackhole Postmark server token available (servername: `sidebadger-me-blackhole`).
    *   **DONE:** Add instance config entry to `firebase/functions/.env.instance*`: `__POSTMARK_SERVERNAME=sidebadger-me-blackhole`.
    *   **DONE:** Add `.secret.local` for local emulator development with pre-flight check on startup.
    *   **TODO:** Create/set `POSTMARK_API_KEYS_JSON` in Secret Manager for staging/production deployment.

## Alternative Integration: SMTP

While the REST API is preferred, SMTP remains an option, particularly for applications that already have SMTP integration.

**Connection Details:**
- **Server:** `smtp.postmarkapp.com`
- **Ports:** `587`, `2525`, or `25`
- **Authentication:** `TLS` is recommended.

**Credentials:**
There are two methods for authentication:

1.  **Server API Token:**
    -   Use the **Server API Token** for both the SMTP username and password.
    -   To direct emails to a specific message stream, an SMTP header must be added: `X-PM-Message-Stream: your-pm-message-stream-id`

2.  **SMTP Token:**
    -   **Username:** Use the `Access Key` from the message stream's settings.
    -   **Password:** Use the `Secret Key`.
    -   This method ties the credentials directly to a specific message stream.

## Resources

- Postmark Login: https://account.postmarkapp.com/login
- API Docs: https://postmarkapp.com/developer
- Node.js Client: https://github.com/ActiveCampaign/postmark.js
