# Schema Usage: Gaps & Inconsistencies Report

## Executive Summary

While the project has a strong foundation for a schema-driven architecture, particularly in the `packages/shared` directory, its application is inconsistent. This has resulted in significant gaps across multiple areas:

1. **CRITICAL**: No backend response validation - responses are never validated against schemas before sending (mitigated by frontend validation)
2. ~~**CRITICAL**: No schema contract tests~~ → **RESOLVED** (commit 2bd04f1b added comprehensive `api-schemas.test.ts`)
3. **HIGH**: Frontend forms don't use shared request schemas - manual validation duplicates rules (acknowledged gap with future plan)
4. **HIGH**: Sanitization inconsistency - create operations sanitize, but updates often don't
5. **HIGH**: Groups module uses legacy validation pattern instead of `createRequestValidator`

---

## Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| CRITICAL | 1 | Must fix - security/reliability risks |
| HIGH | 5 | Should fix - significant maintenance burden |
| MEDIUM | 4 | Nice to have - consistency improvements |
| LOW | 2 | Minor - housekeeping |
| RESOLVED | 1 | Recently fixed |

---

## 1. Backend Response Validation [CRITICAL]

**The backend does NOT validate its own responses before sending them to clients.**

### Mitigating Factor

Per `docs/guides/code.md`, the **frontend DOES validate API responses** using Zod schemas via `apiClient`. This provides runtime protection on the client side, catching malformed responses before they corrupt application state.

However, this is defense-in-depth, not a substitute for server-side validation.

### Evidence

Handlers directly call `res.json(serviceResult)` without schema validation:

```typescript
// ExpenseHandlers.ts:20
const expense = await this.expenseService.createExpense(userId, expenseData);
res.status(HTTP_STATUS.CREATED).json(expense);  // Never validated server-side

// GroupHandlers.ts
const group = await this.groupService.createGroup(userId, sanitizedData);
res.status(HTTP_STATUS.CREATED).json(group);  // Never validated server-side
```

### Affected Files
- `firebase/functions/src/expenses/ExpenseHandlers.ts`
- `firebase/functions/src/groups/GroupHandlers.ts`
- `firebase/functions/src/settlements/SettlementHandlers.ts`
- `firebase/functions/src/comments/CommentHandlers.ts`
- All other handler files

### Impact
- Services could return malformed data (missing fields, wrong types, extra fields)
- Frontend validation catches issues at runtime, but errors surface to users rather than failing fast on server
- No server-side guarantee that responses match TypeScript types
- Potential for schema drift between what server sends and what schemas define

---

## 2. Schema Testing Gaps [RESOLVED ✅]

**~~No tests verify that API responses actually match defined schemas.~~**

### Status: RESOLVED (November 2025)

Commit `2bd04f1b` added comprehensive API schema validation tests in `packages/shared/src/__tests__/unit/api-schemas.test.ts` (656 lines).

### What Was Added
- Tests verify Zod schemas include ALL fields that backend returns
- Comprehensive coverage for: `AppConfigurationSchema`, `ExpenseSplitSchema`, `SimplifiedDebtSchema`, `ApiErrorResponseSchema`, `TenantDomainsResponseSchema`, `TenantSettingsResponseSchema`, `AdminTenantItemSchema`, `AdminTenantsListResponseSchema`, `ActivityFeedItemSchema`, `ActivityFeedResponseSchema`, `BalanceDisplaySchema`, `CurrencyBalanceDisplaySchema`, `ListAuthUsersResponseSchema`
- Tests both required and optional fields
- Tests validation rejection of invalid data

### Remaining Gap
- Handler-level integration tests that validate actual API responses through schemas are still not present
- The new tests verify schema correctness, but don't verify handlers return schema-compliant data

---

## 3. Missing Response Schemas [HIGH]

**9+ response types have TypeScript interfaces but no Zod schemas.**

Per `docs/guides/types.md`: *"ALL request/response types MUST be defined in the shared package... No exceptions - request/response types always go in shared."*

These missing schemas violate project guidelines.

### Missing Schemas

| Type | Location in `shared-types.ts` | Notes |
|------|-------------------------------|-------|
| `RegisterResponse` | Lines 1076-1083 | No schema |
| `MergeJobResponse` | Lines 1155-1164 | No schema |
| `InitiateMergeResponse` | Lines 1147-1150 | No schema |
| `CreatePolicyResponse` | Lines 1248-1261 | No schema |
| `UpdatePolicyResponse` | Lines 1248-1261 | No schema |
| `PublishPolicyResponse` | Lines 1248-1261 | No schema |
| `ListAuthUsersResponse` | Lines 1614-1628 | No schema |
| `ListFirestoreUsersResponse` | Lines 1614-1628 | No schema |
| `TenantBrowserRecord` | Lines 1630-1645 | No schema |
| `ListAllTenantsResponse` | Lines 1630-1645 | No schema |
| `PublishTenantThemeResponse` | Lines 1651-1664 | No schema |

### Impact
- Cannot validate these responses at runtime
- Frontend cannot verify API contracts for these endpoints

---

## 4. Validation Edge Cases [HIGH]

### 4.1 Sanitization Inconsistency

**Create operations sanitize inputs, but update operations often skip sanitization.**

| Feature | Create Sanitizes | Update Sanitizes | Gap |
|---------|------------------|------------------|-----|
| Groups | ✅ Yes | ❌ No | `validateUpdateGroup` uses `parseWithApiError` directly |
| Policies | ✅ Yes | ❌ No | `validateUpdatePolicy` passes `value.text` without sanitization |
| Expenses | ✅ Yes | ✅ Yes | Consistent |
| Settlements | ✅ Yes | ✅ Yes | Consistent |

**Files with gaps:**
- `firebase/functions/src/groups/validation.ts:47-56` - `validateUpdateGroup` bypasses sanitization
- `firebase/functions/src/policies/validation.ts:137` - `validateUpdatePolicy` doesn't sanitize text

**Security Impact:** XSS vulnerabilities via update operations

### 4.2 Amount Precision Validation Gaps

| Scenario | Validated | Notes |
|----------|-----------|-------|
| Expense create with amount+currency | ✅ Yes | Precision checked |
| Expense update with amount+currency | ✅ Yes | Precision checked |
| Expense update with amount only | ❌ No | Skips precision check (line 291-293 comments on this) |
| Settlement create | ❌ No | No precision validation at all |
| Settlement update | ❌ No | Only validates if both amount AND currency provided |

**Files:**
- `firebase/functions/src/expenses/validation.ts:291-293`
- `firebase/functions/src/settlements/validation.ts:241-246`

### 4.3 Pagination Limits Not Enforced

**No maximum limit enforced - `?limit=999999` would create huge queries.**

```typescript
// CommentHandlers.ts:62
const parsedLimit = parseInt(limit as string, 10) || 8;
// No max limit check!
```

**Files:**
- `firebase/functions/src/comments/CommentHandlers.ts:62, 69, 96, 103`
- `firebase/functions/src/utils/pagination.ts`

### 4.4 Weak Cursor Validation

Cursor validation accepts any base64 string without validating internal structure until parse time.

---

## 5. Backend Validation Pattern Inconsistency [HIGH]

**Two competing validation patterns exist in the codebase.**

Per `docs/guides/validation.md`: *"Build request validators with `createRequestValidator` so that parsing, sanitisation, and error mapping remain consistent."*

The groups module does not follow this guidance.

### Modern Pattern: `createRequestValidator`

**Used in:** `auth`, `comments`, `expenses`, `merge`, `policies`, `settlements`, `user` (7 modules)

**Location:** `firebase/functions/src/validation/common/request-validator.ts`

**Features:**
- Field-specific error codes (`MISSING_GROUP_ID`, `INVALID_AMOUNT`)
- Function-based messages that inspect Zod issues
- Integrated `transform` step for sanitization
- Separate `mapError` handler

```typescript
const baseCreateExpenseValidator = createRequestValidator({
    schema: CreateExpenseRequestSchema,
    transform: (value) => ({
        description: sanitizeInputString(value.description),
        // All sanitization in one place
    }),
    mapError: (error) => createExpenseErrorMapper(error),
});
```

### Legacy Pattern: `parseWithApiError`

**Used in:** `groups` (1 module)

**Location:** `firebase/functions/src/utils/validation.ts`

**Features:**
- Generic `INVALID_INPUT` error codes
- Static string messages only
- Sanitization done separately in `sanitizeGroupData()`

```typescript
export const validateCreateGroup = (body: unknown): CreateGroupRequest => {
    return parseWithApiError(CreateGroupRequestSchema, body, {
        name: { code: 'INVALID_INPUT', message: '' },
    });
};
```

### Impact
- Inconsistent error codes for clients
- Duplicated sanitization logic
- Harder to maintain

---

## 6. Frontend Form Validation Gap [HIGH]

**Request schemas are NOT used for form validation in the frontend.**

Per `docs/guides/validation.md`: *"Future shared surface: design an `@billsplit/shared/src/schemas/apiRequests.ts` module to host request DTOs consumed by both client and server once request/response contracts stabilise."*

This gap is acknowledged and planned for future work.

### Evidence

The frontend imports types but NOT Zod schemas for validation:

```typescript
// What's imported (types only)
import { CreateGroupRequest, GroupDTO } from '@billsplit-wl/shared';

// What's NOT imported
// import { CreateGroupRequestSchema } from '@billsplit-wl/shared';
```

### Manual Validation Examples

**Registration Form** (`webapp-v2/src/pages/RegisterPage.tsx:90-116`):
```typescript
const validateForm = (): string | null => {
    if (!name.trim()) return t('registerPage.validation.nameRequired');
    if (password.length < 12) return t('registerPage.validation.passwordTooShort');
    // Manual validation - duplicates backend schema rules
};
```

**Expense Form** (`webapp-v2/src/app/stores/expense-form-store.ts:767-870`):
```typescript
private validateField(field: string, value?: any): string | null {
    switch (field) {
        case 'description':
            if (!desc.trim()) return 'Description is required';
            if (desc.length > 100) return 'Description must be less than 100 characters';
            // Manual switch statement - duplicates backend
    }
}
```

### Impact
- Duplication of validation rules
- Risk of frontend/backend rules drifting out of sync
- Maintenance burden

---

## 7. Local Schema Definitions in Frontend [MEDIUM]

**`webapp-v2/src/app/apiClient.ts` defines local Zod schemas instead of using shared.**

```typescript
// Lines 194-200
const FirestoreUserSchema = z.object({ id: z.string() }).passthrough();

const ListFirestoreUsersResponseSchema = z.object({
    users: z.array(FirestoreUserSchema),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
});
```

### Context
These are admin-only endpoints (2 schemas total). Not a widespread pattern.

### Impact
- Minor duplication
- Could indicate schema mismatch between API and frontend expectations

---

## 8. Error Response Format Inconsistency [MEDIUM]

**Two different error formats are supported.**

### Format 1: Structured
```json
{ "error": { "code": "MISSING_GROUP_ID", "message": "Group ID is required" } }
```

### Format 2: Simple
```json
{ "error": "Group ID is required" }
```

The `ApiErrorResponseSchema` accepts both formats, forcing defensive parsing on the frontend.

### Files
- `packages/shared/src/schemas/apiSchemas.ts` - schema accepts both
- Frontend must handle both cases

---

## 9. Inline Validation in Handlers [MEDIUM]

**Some handlers have inline validation instead of using centralized validators.**

### Examples

**Activity Feed** (`ActivityHandlers.ts:45-60`):
```typescript
private parseQuery(query: Record<string, unknown>): ActivityFeedQuery {
    // Manual validation instead of using a schema
    if (typeof query.limit === 'string') {
        const parsedLimit = parseInt(query.limit, 10);
        if (!Number.isNaN(parsedLimit)) result.limit = parsedLimit;
    }
}
```

**Tenant Admin** (`TenantAdminHandlers.ts:54-72`):
- Inline file validation for images using separate utility functions

### Impact
- Inconsistent error handling (some paths fail silently with defaults)
- Validation logic scattered across codebase

---

## 10. Query Parameter Validation Gaps [MEDIUM]

**Query parameters not consistently validated with schemas.**

| Endpoint | Has Query Schema |
|----------|-----------------|
| Comments list | ✅ `ListCommentsQuerySchema` |
| Expenses list | ❌ No schema |
| Settlements list | ❌ No schema |
| Users list (admin) | ❌ No schema |
| Activity feed | ❌ Manual parsing |

---

## 11. ID Validation Inconsistency [LOW]

**Some paths use explicit validators, others rely on type coercion alone.**

| ID Type | Explicit Validation | Type Coercion Only |
|---------|--------------------|--------------------|
| GroupId | `groups/validation.ts:88-94` | `expenses/validation.ts:71` |
| ExpenseId | `expenses/validation.ts:200-206` | - |
| UserId | `groups/validation.ts:169-174` | `expenses/validation.ts:79` |

---

## 12. Empty Content Validation [LOW]

**Comment text allows whitespace-only content after sanitization.**

```typescript
// comments/validation.ts:27
// Uses CommentBodySchema - validates it's a string, then sanitizes
// But "   " becomes "" after trim and is still allowed
```

---

## Recommendations

### Immediate (Critical)
1. Add response validation middleware that validates all responses before sending
2. ~~Add schema contract tests for all endpoints~~ → DONE (commit 2bd04f1b)
3. Apply sanitization consistently to all update operations

### Short-term (High Priority)
4. Create Zod schemas for all missing response types
5. Migrate groups module to modern `createRequestValidator` pattern
6. Integrate shared request schemas into frontend form validation
7. Fix amount precision validation gaps

### Medium-term (Important)
8. Standardize error response format
9. Add query parameter schemas for all list endpoints
10. Enforce pagination limits (min/max bounds)
11. Move inline validation to centralized validators

