# Unit Tests Middleware Coverage

## Problem
Unit tests in `firebase/functions/src/__tests__/unit` use `AppDriver` and bypass the standard middleware stack. This skips production behaviors like:
- response serialization + schema validation
- content-type validation
- request structure validation
- cache/security headers
- correlation IDs and slow-request logging

Auth middleware is also bypassed: tests inject `req.user` directly, so token verification paths are not exercised.

We want unit tests to exercise the full backend stack (except the HTTP socket layer) while remaining fast and in-process.

## Constraints
- No HTTP sockets in unit tests.
- Tests must remain fast and deterministic.
- Avoid full emulator or network usage.
- Must not break existing test patterns, especially `AppDriver` consumers.

## Research Notes
- `applyStandardMiddleware` relies on `getAppConfig()` and `express.json()`; it assumes a real Express request stream.
- `authenticate` middleware pulls from `ComponentBuilderSingleton`, which initializes real Firebase Admin services.
- `AppDriver` currently returns `res.getJson()`; real middleware serializes JSON and writes to `res.send()`.
- `createStubRequest` injects `req.user`, bypassing auth and token verification.

## Plan
- Identify which middleware can run in unit tests without HTTP streams.
- Propose a middleware refactor that supports in-process execution:
  - Extract a standard middleware chain factory (with options to skip body parsing).
  - Convert auth middleware into a factory that accepts injected services.
- Update the test harness design:
  - Extend stub request/response to support headers, statusCode, headersSent, on('finish'), and raw body capture.
  - Add serializer-aware response reading in `AppDriver` (deserialize when content-type is serialized JSON).
  - Switch tests to pass Authorization headers instead of pre-seeded `req.user` where possible.
- Define minimal env/config injection to satisfy `getAppConfig()` in tests.
- Identify high-risk test areas (response validation, binary uploads, tenant admin) and ensure compatibility.
- Document any middleware pieces that remain out-of-scope for unit tests and keep integration tests for those.

## Open Questions
- Should unit tests fully replace the current auth bypass, or keep a test-only auth mode?
- Is it acceptable to change `createStubRequest` defaults (e.g., no `req.user`) and update tests accordingly?
- Which middleware should be optionally skipped in unit tests (e.g., body parsing)?

## Progress
- Task created; plan pending approval.
