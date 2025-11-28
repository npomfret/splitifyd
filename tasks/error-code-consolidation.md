# Error Code Consolidation

**Prerequisite for:** `api-error-i18n.md`

**Problem:** The codebase has ~115 unique error codes scattered across handlers and services, with significant redundancy and inconsistency. Before implementing i18n, we need to consolidate to a manageable, well-organized set.

**Current Issues:**
- Redundant codes: `FORBIDDEN` vs `ACCESS_DENIED` vs `NOT_AUTHORIZED` vs `INSUFFICIENT_PERMISSIONS`
- Inconsistent specificity: Generic `NOT_FOUND` alongside `GROUP_NOT_FOUND`, `EXPENSE_NOT_FOUND`, etc.
- Mixed concerns: Some codes are user-facing, others are internal/admin-only
- No hierarchy: Flat namespace makes categorization impossible

---

## Recommendation: Hierarchical Error Code System

Based on industry best practices (Microsoft, Stripe, GitHub APIs), implement a **two-tier error code system**:

### Tier 1: Category Codes (~15-20)

Broad categories that clients must handle. These are the primary codes for i18n translation.

| Category | HTTP Status | Description |
|----------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | Not authenticated |
| `AUTH_INVALID` | 401 | Bad/expired token |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `ALREADY_EXISTS` | 409 | Duplicate resource |
| `CONFLICT` | 409 | Concurrent modification |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `INVALID_REQUEST` | 400 | Malformed request structure |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVICE_ERROR` | 500 | Internal server error |
| `UNAVAILABLE` | 503 | Service temporarily unavailable |

### Tier 2: Detail Codes (optional, for debugging)

Specific codes nested under categories. Not translated - used for logging, debugging, and programmatic handling.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "detail": "GROUP_NOT_FOUND",
    "resource": "Group",
    "resourceId": "abc123"
  }
}
```

The `detail` field provides specificity without exploding the translation namespace.

---

## Consolidation Mapping

### Authentication/Authorization (~6 codes → 3)

| Current Codes | Consolidated To |
|---------------|-----------------|
| `UNAUTHORIZED`, `AUTH_REQUIRED` | `AUTH_REQUIRED` |
| `INVALID_TOKEN`, `AUTH_TOKEN_HAS_EXPIRED` | `AUTH_INVALID` |
| `FORBIDDEN`, `ACCESS_DENIED`, `NOT_AUTHORIZED`, `INSUFFICIENT_PERMISSIONS` | `FORBIDDEN` |

### Not Found (~10 codes → 1 + detail)

| Current Codes | Consolidated To |
|---------------|-----------------|
| `NOT_FOUND`, `GROUP_NOT_FOUND`, `EXPENSE_NOT_FOUND`, `SETTLEMENT_NOT_FOUND`, `USER_NOT_FOUND`, `POLICY_NOT_FOUND`, `TENANT_NOT_FOUND`, `JOB_NOT_FOUND`, `VERSION_NOT_FOUND`, `BALANCE_NOT_FOUND` | `NOT_FOUND` with `detail` and `resource` fields |

### Validation (~30+ codes → 1 + details)

| Current Codes | Consolidated To |
|---------------|-----------------|
| `INVALID_INPUT`, `MISSING_FIELD`, `INVALID_*` (all validation codes) | `VALIDATION_ERROR` with `field` and `detail` in response |

### Conflict (~5 codes → 2)

| Current Codes | Consolidated To |
|---------------|-----------------|
| `ALREADY_EXISTS`, `ALREADY_MEMBER`, `EMAIL_ALREADY_EXISTS`, `VERSION_ALREADY_EXISTS`, `POLICY_EXISTS`, `DISPLAY_NAME_TAKEN` | `ALREADY_EXISTS` with `resource` field |
| `CONCURRENT_UPDATE` | `CONFLICT` |

### Operation Failures (~20+ codes → 1 + detail)

| Current Codes | Consolidated To |
|---------------|-----------------|
| `*_FAILED`, `*_ERROR` codes | `SERVICE_ERROR` with `detail` for logging |

---

## Response Format

### User-Facing Errors (translated by frontend)

```json
{
  "error": {
    "code": "NOT_FOUND",
    "resource": "Group"
  }
}
```

Frontend translates: `apiErrors.NOT_FOUND` → "{{resource}} not found" → "Group not found"

### Validation Errors (field-specific)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "amount": "INVALID_AMOUNT",
      "email": "INVALID_FORMAT"
    }
  }
}
```

Frontend translates each field error separately using `validationErrors.{fieldCode}`.

### Internal/Debug Errors (not user-facing)

```json
{
  "error": {
    "code": "SERVICE_ERROR",
    "detail": "MERGE_EXECUTION_FAILED",
    "correlationId": "abc123"
  }
}
```

Frontend shows generic message for `SERVICE_ERROR`; `detail` is for logs only.

---

## Implementation Steps

### 1. Define Error Categories

Create `firebase/functions/src/errors/ErrorCodes.ts`:

```typescript
export const ErrorCode = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  FORBIDDEN: 'FORBIDDEN',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Input
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',

  // Limits
  RATE_LIMITED: 'RATE_LIMITED',

  // Server
  SERVICE_ERROR: 'SERVICE_ERROR',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];
```

### 2. Update ApiError Class

Extend to support `detail`, `resource`, `field`, and other interpolation data:

```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    public data?: {
      detail?: string;      // Specific error for logging
      resource?: string;    // Resource type for NOT_FOUND, ALREADY_EXISTS
      field?: string;       // Field name for VALIDATION_ERROR
      fields?: Record<string, string>;  // Multiple field errors
      [key: string]: unknown;
    }
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
```

### 3. Update Errors Factory

Replace current factory with category-based approach:

```typescript
export const Errors = {
  // Auth
  authRequired: () => new ApiError(401, ErrorCode.AUTH_REQUIRED),
  authInvalid: (detail?: string) => new ApiError(401, ErrorCode.AUTH_INVALID, { detail }),
  forbidden: (detail?: string) => new ApiError(403, ErrorCode.FORBIDDEN, { detail }),

  // Resources
  notFound: (resource: string, detail?: string) =>
    new ApiError(404, ErrorCode.NOT_FOUND, { resource, detail }),
  alreadyExists: (resource: string, detail?: string) =>
    new ApiError(409, ErrorCode.ALREADY_EXISTS, { resource, detail }),
  conflict: (detail?: string) => new ApiError(409, ErrorCode.CONFLICT, { detail }),

  // Validation
  validationError: (field: string, detail?: string) =>
    new ApiError(400, ErrorCode.VALIDATION_ERROR, { field, detail }),
  validationErrors: (fields: Record<string, string>) =>
    new ApiError(400, ErrorCode.VALIDATION_ERROR, { fields }),
  invalidRequest: (detail?: string) =>
    new ApiError(400, ErrorCode.INVALID_REQUEST, { detail }),

  // Server
  serviceError: (detail?: string) =>
    new ApiError(500, ErrorCode.SERVICE_ERROR, { detail }),
  unavailable: (detail?: string) =>
    new ApiError(503, ErrorCode.UNAVAILABLE, { detail }),
};
```

### 4. Migrate Existing Code

Search and replace all `new ApiError(...)` and `Errors.*` calls to use new factory. Map old codes to new ones:

```typescript
// Before
throw new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found');

// After
throw Errors.notFound('Group', 'GROUP_NOT_FOUND');
```

### 5. Update Error Serialization

Modify `sendError` to output clean response format:

```typescript
export const sendError = (res: Response, error: ApiError): void => {
  res.status(error.statusCode).json({
    error: {
      code: error.code,
      ...error.data,  // Spread resource, field, fields, etc.
    },
  });
};
```

### 6. Add Frontend Translations

After consolidation, only ~12 category codes need translation (vs 115 before):

```json
{
  "apiErrors": {
    "AUTH_REQUIRED": "Please sign in to continue",
    "AUTH_INVALID": "Your session has expired. Please sign in again.",
    "FORBIDDEN": "You don't have permission to do this",
    "NOT_FOUND": "{{resource}} not found",
    "ALREADY_EXISTS": "{{resource}} already exists",
    "CONFLICT": "Someone else made changes. Please refresh and try again.",
    "VALIDATION_ERROR": "Please check your input",
    "INVALID_REQUEST": "Something went wrong with your request",
    "RATE_LIMITED": "Too many requests. Please wait a moment.",
    "SERVICE_ERROR": "Something went wrong. Please try again.",
    "UNAVAILABLE": "Service temporarily unavailable. Please try again later."
  }
}
```

---

## Benefits

1. **Manageable i18n scope** - 12 translations vs 115
2. **Consistent UX** - Users see predictable, well-crafted messages
3. **Debugging preserved** - `detail` field retains specific error info for logs
4. **Type safety** - `ErrorCode` enum prevents typos
5. **Extensible** - New specific errors add `detail` values, not new categories

---

## References

- [API Error Code Management Guide](https://guptadeepak.com/comprehensive-guide-to-api-error-code-management/)
- [Zuplo: API Error Handling Best Practices](https://zuplo.com/learning-center/best-practices-for-api-error-handling)
- [Speakeasy: REST API Error Design](https://www.speakeasy.com/api-design/errors)
- [Baeldung: REST API Error Handling](https://www.baeldung.com/rest-api-error-handling-best-practices)
