# Webapp Issue: Create a Service Layer for API Calls

## Issue Description

`fetch()` calls are scattered throughout the UI code, mixing concerns and making the code hard to test.

## Recommendation

Consolidate all API calls into a dedicated service layer.

## Implementation Suggestions

Create a `webapp/js/services/` directory with modules like `apiService.js`, `authService.js`, etc. Components will call these services instead of using `fetch` directly.

### Current Status:

It appears `webapp/src/js/api.ts` already exists and serves as a service layer for general API calls. The issue is that `auth.ts` still contains direct `fetch` calls and a private `makeRequest` method. This is already covered in `webapp-redundant-api-calls.md`.

### Action:

Refer to `docs/todo/issues/webapp-redundant-api-calls.md` for the implementation details to consolidate API calls.
