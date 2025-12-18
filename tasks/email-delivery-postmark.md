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
    *   For **all environments** (including the Firebase emulator when configured for integration testing, and "real" Firebase environments like staging/production), the Postmark API token (which corresponds to the value of the `X-Postmark-Server-Token` header) will be sourced from Google Secret Manager.
    *   The service account used by the Cloud Functions will need appropriate IAM permissions to access this secret.
    *   During local development, for a "blackhole" configuration, the special Postmark test token `POSTMARK_API_TEST` will be retrieved from Secret Manager.

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

*   **Install Dependency:** Add `postmark` to `firebase/functions/package.json`.
*   **Define `IEmailService`:** Create the interface file.
*   **Implement `PostmarkEmailService`:** Create the real service implementation.
*   **Implement `FakeEmailService`:** Create the test service implementation.
*   **Configure Google Secret Manager:** Create a secret for the Postmark API token in Google Cloud.
*   **Update `ServiceConfig.ts`:** Add logic to fetch the Postmark API token from Secret Manager.
*   **Update `ComponentBuilder.ts`:** Add the `buildEmailService` method with conditional logic.
*   **Integrate `IEmailService`:** Inject into relevant services.
*   **Update Test Setup:** Ensure `AppDriver.ts` correctly initializes the email service for tests.

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
