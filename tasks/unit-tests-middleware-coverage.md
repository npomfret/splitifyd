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

## Decisions

1. **Validation failures**: Throw immediately (fail fast) - catches API contract violations early
2. **Migration scope**: Migrate ALL existing tests after implementation
3. **Auth testing**: Keep bypassed - tests inject `req.user` directly (token verification stays out of scope)

## Implementation Plan

### Phase 1: Extend StubResponse for Middleware Compatibility

**File:** `packages/test-support/src/http-stubs.ts`

Add missing methods/properties that `applyStandardMiddleware` requires:
- `headers: Record<string, string>` internal storage
- `statusCode: number` property (mirrors `status()`)
- `headersSent: boolean` flag (set after `json()`/`send()`)
- `setHeader(name, value)` method
- `getHeaders()` getter for test assertions
- `on(event, listener)` no-op stub for `res.on('finish', ...)`

Update `getJson()` to auto-deserialize if response was serialized:
```typescript
getJson: () => {
    if (typeof bodyData === 'string' && contentType?.includes('serialized-json')) {
        return ApiSerializer.deserialize(bodyData);
    }
    return jsonData;
}
```

### Phase 2: Create Test AppConfig Provider

**File:** `firebase/functions/src/__tests__/test-config.ts` (extend existing)

Add `createTestAppConfig()` function returning safe defaults for validation limits, cache settings, security headers, etc.

### Phase 3: Create MiddlewareHarness

**New File:** `firebase/functions/src/__tests__/unit/middleware-harness.ts`

Extract testable middleware logic into a reusable harness:

```typescript
export interface MiddlewareHarnessOptions {
    validateResponses?: boolean;        // default: true
    serializeResponses?: boolean;       // default: true
    validateRequestStructure?: boolean; // default: false
    validateContentType?: boolean;      // default: false
    validationConfig?: {...};
}

export class MiddlewareHarness {
    wrapResponse(res, req): void;     // Override res.json() for validation/serialization
    validateRequest(req): void;       // Pre-handler validation
}
```

Key behaviors:
- `wrapResponse()` overrides `res.json()` to validate against `getResponseSchema()` and serialize via `ApiSerializer`
- Throws `RESPONSE_VALIDATION_FAILED` on schema violations
- `validateRequest()` optionally checks content-type and request structure

### Phase 4: Integrate into AppDriver

**File:** `firebase/functions/src/__tests__/unit/AppDriver.ts`

Add optional middleware harness:

```typescript
export interface AppDriverOptions {
    enableMiddlewareStack?: boolean;  // default: false (backward compat)
    middlewareOptions?: MiddlewareHarnessOptions;
}
```

In `dispatchByHandler()`:
- If `enableMiddlewareStack`, apply `middlewareHarness.wrapResponse()` and `validateRequest()`
- Otherwise, existing behavior unchanged

### Phase 5: Convenience Factory

**New File:** `firebase/functions/src/__tests__/unit/AppDriverWithMiddleware.ts`

```typescript
export function createAppDriverWithMiddleware(options?): AppDriver {
    return new AppDriver({
        enableMiddlewareStack: true,
        middlewareOptions: { validateResponses: true, serializeResponses: true, ...options }
    });
}
```

### Phase 6: Add Middleware Tests

**New File:** `firebase/functions/src/__tests__/unit/middleware/response-validation.test.ts`

Verify the harness catches schema violations, serialization works, etc.

### Phase 7: Migrate Existing Tests

After phases 1-6 verified working:
1. Enable middleware stack for all existing tests
2. Fix any schema violations discovered
3. Flip default to `enableMiddlewareStack: true`
4. Remove opt-out flag

## Files to Modify

| File | Changes |
|------|---------|
| `packages/test-support/src/http-stubs.ts` | Add setHeader, headersSent, statusCode, getHeaders, auto-deserialize in getJson |
| `firebase/functions/src/__tests__/test-config.ts` | Add createTestAppConfig() |
| `firebase/functions/src/__tests__/unit/AppDriver.ts` | Add AppDriverOptions, integrate MiddlewareHarness |
| `firebase/functions/src/__tests__/unit/middleware-harness.ts` | New file - extract testable middleware |
| `firebase/functions/src/__tests__/unit/AppDriverWithMiddleware.ts` | New file - convenience factory |
| `firebase/functions/src/__tests__/unit/middleware/response-validation.test.ts` | New file - test the harness |

## What Stays Out of Scope

1. **Token verification** - Remains bypassed (requires Firebase Auth)
2. **HTTP socket testing** - Stays as integration test concern
3. **LoggerContext/correlation IDs** - Low priority, could be added later

## Progress

- [x] Task created
- [x] Research completed
- [x] Plan approved
- [ ] Phase 1: Extend StubResponse
- [ ] Phase 2: Create test AppConfig provider
- [ ] Phase 3: Create MiddlewareHarness
- [ ] Phase 4: Integrate into AppDriver
- [ ] Phase 5: Add convenience factory
- [ ] Phase 6: Add middleware tests
- [ ] Phase 7: Migrate existing tests
