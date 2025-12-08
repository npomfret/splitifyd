# Add public convenience methods for policy endpoints

This task adds convenience methods to the PublicAPI interface for fetching common policy types without needing to know the policy ID.

## Requirements

1. **Publicly Accessible:** Endpoints must not require user authentication.
2. **Convenience Methods:** Provide named methods for each common policy type.
3. **Reuse Existing Endpoint:** Methods wrap the existing `getCurrentPolicy` endpoint.

## Implementation

Added 3 convenience methods to `PublicAPI` interface that wrap `getCurrentPolicy`:

- `getPrivacyPolicy()` - calls `getCurrentPolicy('privacy-policy')`
- `getTermsOfService()` - calls `getCurrentPolicy('terms-of-service')`
- `getCookiePolicy()` - calls `getCurrentPolicy('cookie-policy')`

## Task Breakdown

- [x] Add convenience methods to `PublicAPI` interface
- [x] Implement in ApiClient (webapp)
- [x] Implement in ApiDriver (integration tests)
- [x] Implement in AppDriver (unit tests)
- [x] Write unit tests

## Files Changed

- `packages/shared/src/api.ts` - Added convenience methods to `PublicAPI` interface
- `webapp-v2/src/app/apiClient.ts` - Added client implementation
- `packages/test-support/src/ApiDriver.ts` - Added test driver implementation
- `firebase/functions/src/__tests__/unit/AppDriver.ts` - Added unit test driver
- `firebase/functions/src/__tests__/unit/api/public-policies.test.ts` - 6 unit tests
- `firebase/functions/src/__tests__/integration/public-endpoints.test.ts` - Fixed missing `beforeAll` import

## Status: COMPLETE
