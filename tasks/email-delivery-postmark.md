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

- [ ] Send transactional emails (password reset, email verification, etc.)
- [ ] Send notification emails (group invites, expense notifications, etc.)
- [ ] Handle bounces and complaints
- [ ] Track delivery status
- [ ] Support email templates

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
- **Secret ID convention:** `postmark_api_key_<postmarkServerNameNormalized>` (each key corresponds to a Postmark "Server").
  - Normalization: project enforces Secret IDs matching `[a-zA-Z_0-9]+`, so non-matching characters in `<postmarkServerName>` are replaced with `_`.
- **Env convention:** each Firebase instance `.env.instance*` provides `postmark-servername=<postmarkServerName>` (the app uses this logical name to locate the secret).
- **Current configured Postmark server:** `blackhole` only (all emails should route to Postmark "blackhole" behavior).
- **Open decision (Firebase secrets best practice):** Firebase `defineSecret()` prefers static secret names known at deploy time. If we need dynamic `postmark-servername` selection (demo/prod/multi-tenant), we likely want a single JSON secret map (e.g. `POSTMARK_API_KEYS_JSON`) rather than one secret per server.

## Script: Add API key secret

- Add/update a Postmark server token in Secret Manager:
  - `firebase/scripts/firebase/add-postmark-api-key-secret.ts`
  - Uses `firebase/service-account-key.json` to resolve `project_id` by default.

## Plan (Incremental)

### Phase 1: Secrets + Instance Config (small)

- [x] Define secret ID convention: `postmark_api_key_<postmarkServerNameNormalized>`
- [x] Define env convention: `.env.instance*` contains `postmark-servername=<postmarkServerName>`
- [x] Add script to upsert secret + add new version: `firebase/scripts/firebase/add-postmark-api-key-secret.ts`
- [ ] Decide how instance selection affects secrets: demo/prod/staging mapping and whether each uses distinct projects or distinct secret names

### Phase 2: Backend Email Abstraction (medium)

- [ ] Add `IEmailService` interface in `firebase/functions/src/services/email/IEmailService.ts`
- [ ] Add `FakeEmailService` for unit tests
- [ ] Add `PostmarkEmailService` (REST API) reading token from Secret Manager
- [ ] Wire `IEmailService` in `firebase/functions/src/services/ComponentBuilder.ts` (Fake in unit tests, Postmark otherwise)

### Phase 3: Sending + Observability (medium)

- [ ] Integrate `IEmailService` into the first real email use-case (pick one: group invites or auth email flows)
- [ ] Add targeted unit test(s) asserting expected email “send” via `FakeEmailService`
- [ ] Add delivery event tracking hooks (webhook ingestion) and persistence strategy (TBD)

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
    *   The Postmark API token(s) will be stored in Google Secret Manager.
    *   **Preferred Firebase approach:** use Firebase Functions secrets integration (`defineSecret()` / `secrets: [...]`) instead of calling Secret Manager at runtime.
        *   This avoids repeated Secret Manager reads per request (and cost) and naturally caches per function instance.
        *   Note: secrets referenced via `defineSecret()` must be known at deploy time (static secret names).
    *   **Two viable patterns (pick one):**
        *   **(A) Single JSON secret (recommended if we need dynamic servername selection):** store a secret like `POSTMARK_API_KEYS_JSON` whose value is a JSON map `{ "<postmark-servername>": "<token>", ... }`. Then `.env.instance*` continues to set `postmark-servername=...`, and the code selects from the parsed map.
        *   **(B) One secret per server (works if the set is small/static):** define/bind each secret individually via `defineSecret('POSTMARK_API_KEY_SIDEBADGER_ME_BLACKHOLE')` etc and choose between them at runtime.
    *   **If we do direct Secret Manager reads (fallback only):** implement an in-memory cache for the life of the function instance, and a “single-flight” Promise so concurrent requests don’t trigger multiple reads while one is in-flight.
    *   **Local emulation:** Firebase Functions supports overriding secret values via a local `.secret.local` file; otherwise the emulator attempts to access deployed secrets.

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
    *   **DONE:** A Postmark "blackhole" server token has been stored in Secret Manager as `postmark_api_key_sidebadger_me_blackhole`.
    *   **TODO:** Decide between secret patterns (single JSON secret vs per-server secrets) so we can integrate with Firebase Functions `defineSecret()` cleanly.
    *   **TODO:** Add the selected secret(s) via Firebase CLI (`firebase functions:secrets:set ...`) or via the repo script (`firebase/scripts/firebase/add-postmark-api-key-secret.ts`) depending on the chosen management approach.
    *   **TODO:** Add instance config entry to `firebase/functions/.env.instance*`: `postmark-servername=sidebadger-me-blackhole` (and later per-instance values like demo/prod).

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
