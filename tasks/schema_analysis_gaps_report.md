# Schema Usage: Gaps & Inconsistencies Report

## Executive Summary

While the project has a strong foundation for a schema-driven architecture, particularly in the `packages/shared` directory, its application is inconsistent. This has resulted in significant gaps across multiple areas:

1. ~~**CRITICAL**: No backend response validation~~ → **RESOLVED** (November 2025 - response validation middleware added)
2. ~~**CRITICAL**: No schema contract tests~~ → **RESOLVED** (commit 2bd04f1b added comprehensive `api-schemas.test.ts`)
3. ~~**HIGH**: Frontend forms don't use shared request schemas~~ → **PARTIALLY RESOLVED** (November 2025 - auth pages + expense form simple fields migrated)
4. ~~**HIGH**: Sanitization inconsistency~~ → **RESOLVED** (November 2025 - policies update now sanitizes)
5. ~~**HIGH**: Groups module uses legacy validation pattern~~ → **RESOLVED** (November 2025 - migrated to `createRequestValidator`)

---

## Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | Must fix - security/reliability risks |
| HIGH | 0 | Should fix - significant maintenance burden |
| MEDIUM | 0 | Nice to have - consistency improvements |
| LOW | 2 | Minor - housekeeping |
| PARTIAL | 1 | Partially resolved (item #6) |
| RESOLVED | 12 | Recently fixed |

---

## 1. Backend Response Validation [RESOLVED ✅]

**~~The backend does NOT validate its own responses before sending them to clients.~~**

### Status: RESOLVED (November 2025)

Response validation middleware was added to `firebase/functions/src/utils/middleware.ts`.

### Implementation Details

1. **Response validation middleware** intercepts all `res.json()` calls
2. **Path normalization** converts Express paths to schema keys (e.g., `/groups/abc123` → `/groups/:id`)
3. **Schema lookup** matches `METHOD /path` against `responseSchemas` in `apiSchemas.ts`
4. **Strict mode**: Returns 500 `RESPONSE_VALIDATION_FAILED` error if response doesn't match schema
5. **Only validates 2xx responses** - error responses have different structure

### Key Functions Added
- `normalizePath(path: string)` - Normalizes dynamic path segments to parameter placeholders
- `getResponseSchema(method: string, path: string)` - Looks up response schema for endpoint

### Tests Added
- `firebase/functions/src/__tests__/unit/middleware/response-validation.test.ts` (18 tests)

### Bug Fixes During Implementation
- Fixed path normalization to exclude static endpoints (`/groups/share`, `/groups/join`, etc.) using negative lookahead regex
- Added missing `DELETE /groups/:id` schema

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

## 3. Missing Response Schemas [RESOLVED ✅]

**~~9+ response types have TypeScript interfaces but no Zod schemas.~~**

### Status: RESOLVED (November 2025)

All missing response schemas were added to `packages/shared/src/schemas/apiSchemas.ts`.

### Schemas Added

| Schema | Notes |
|--------|-------|
| `InitiateMergeResponseSchema` | For POST /merge |
| `MergeJobResponseSchema` | For GET /merge/:jobId |
| `CreatePolicyResponseSchema` | For POST /admin/policies |
| `UpdatePolicyResponseSchema` | For PUT /admin/policies/:id |
| `PublishPolicyResponseSchema` | For POST /admin/policies/:id/publish |
| `ListFirestoreUsersResponseSchema` | For GET /admin/browser/users/firestore |
| `PublishTenantThemeResponseSchema` | For POST /admin/tenants/publish |

### Bug Fix
`PublishTenantThemeResponseSchema` was initially incorrect (had `success` and `message` fields). Fixed to match actual `PublishTenantThemeResult` type with `cssUrl`, `tokensUrl`, and `artifact` fields.

---

## 4. Validation Edge Cases [RESOLVED ✅]

### 4.1 Sanitization Inconsistency [RESOLVED ✅]

**~~Create operations sanitize inputs, but update operations often skip sanitization.~~**

#### Status: RESOLVED (November 2025)

| Feature | Create Sanitizes | Update Sanitizes | Status |
|---------|------------------|------------------|--------|
| Groups | ✅ Yes | ✅ Yes | Fixed - migrated to `createRequestValidator` with integrated sanitization |
| Policies | ✅ Yes | ✅ Yes | Fixed - added `sanitizeInputString(value.text)` to transform |
| Expenses | ✅ Yes | ✅ Yes | Already consistent |
| Settlements | ✅ Yes | ✅ Yes | Already consistent |

### 4.2 Amount Precision Validation Gaps [RESOLVED ✅]

**~~Settlement operations missing precision validation.~~**

#### Status: RESOLVED (November 2025)

| Scenario | Validated | Notes |
|----------|-----------|-------|
| Expense create with amount+currency | ✅ Yes | Precision checked |
| Expense update with amount+currency | ✅ Yes | Precision checked |
| Expense update with amount only | ✅ Yes | Now requires currency when updating amount |
| Settlement create | ✅ Yes | Added `validateAmountPrecision` |
| Settlement update | ✅ Yes | Now requires currency when updating amount + precision validation |

#### Breaking API Change
Both expense and settlement updates now **require `currency` field when `amount` is provided**.

### 4.3 Pagination Limits Not Enforced [RESOLVED ✅]

**~~No maximum limit enforced - `?limit=999999` would create huge queries.~~**

#### Status: RESOLVED (November 2025)

All pagination endpoints now enforce `DOCUMENT_CONFIG.LIST_LIMIT` (100) as maximum.

#### Changes Made

**CommentHandlers.ts** - Switched from raw `parseInt` to `validateListCommentsQuery`:
```typescript
// Before:
const { cursor, limit = 8 } = req.query;
// ... limit: parseInt(limit as string, 10) || 8,

// After:
const { cursor, limit } = validateListCommentsQuery(req.query);
```

**GroupHandlers.ts** - Added `Math.min()` to `getGroupFullDetails` pagination params:
```typescript
const expenseLimit = Math.min(parseInt(req.query.expenseLimit as string) || 8, DOCUMENT_CONFIG.LIST_LIMIT);
const settlementLimit = Math.min(parseInt(req.query.settlementLimit as string) || 8, DOCUMENT_CONFIG.LIST_LIMIT);
const commentLimit = Math.min(parseInt(req.query.commentLimit as string) || 8, DOCUMENT_CONFIG.LIST_LIMIT);
```

### 4.4 Weak Cursor Validation [RESOLVED ✅]

**~~Cursor validation accepts any base64 string without validating internal structure until parse time.~~**

#### Status: RESOLVED (November 2025)

The `decodeCursor` function now validates:
1. `updatedAt` field exists and is a string
2. `id` field exists and is a string
3. `updatedAt` is a valid parseable date

#### Implementation (`pagination.ts`)
```typescript
export function decodeCursor(cursor: string): CursorData {
    try {
        const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
        const cursorData = JSON.parse(decodedCursor);

        if (!cursorData.updatedAt || typeof cursorData.updatedAt !== 'string') {
            throw new Error('Invalid cursor: missing or invalid updatedAt');
        }
        if (!cursorData.id || typeof cursorData.id !== 'string') {
            throw new Error('Invalid cursor: missing or invalid id');
        }
        if (isNaN(Date.parse(cursorData.updatedAt))) {
            throw new Error('Invalid cursor: updatedAt is not a valid date');
        }

        return cursorData as CursorData;
    } catch (error) {
        throw Errors.INVALID_INPUT('Invalid cursor format');
    }
}
```

#### Tests Added (`pagination.test.ts`)
- `should throw error for missing id`
- `should throw error for non-string id`
- `should throw error for invalid date format`

---

## 5. Backend Validation Pattern Inconsistency [RESOLVED ✅]

**~~Two competing validation patterns exist in the codebase.~~**

### Status: RESOLVED (November 2025)

The groups module has been migrated to the modern `createRequestValidator` pattern.

### Modern Pattern: `createRequestValidator`

**Now used in:** `auth`, `comments`, `expenses`, `groups`, `merge`, `policies`, `settlements`, `user` (8 modules)

**Location:** `firebase/functions/src/validation/common/request-validator.ts`

### Groups Module Migration

#### Files Modified
- `firebase/functions/src/groups/validation.ts` - Complete rewrite
- `firebase/functions/src/groups/GroupHandlers.ts` - Removed `sanitizeGroupData` calls

#### Changes
- Migrated from legacy `parseWithApiError` to modern `createRequestValidator` pattern
- Created field-specific error mappers:
  - `createGroupErrorMapper`
  - `updateGroupErrorMapper`
  - `updateDisplayNameErrorMapper`
  - `updatePermissionsErrorMapper`
  - `updateMemberRoleErrorMapper`
- Integrated sanitization into validator transforms
- Removed `sanitizeGroupData()` function

#### New Error Codes

| Old Code | New Code |
|----------|----------|
| `INVALID_INPUT` | `INVALID_GROUP_NAME` |
| `INVALID_INPUT` | `INVALID_DISPLAY_NAME` |
| `INVALID_INPUT` | `INVALID_DESCRIPTION` |
| `INVALID_INPUT` | `MISSING_GROUP_ID` |
| `INVALID_INPUT` | `MISSING_MEMBER_ID` |

---

## 6. Frontend Form Validation Gap [PARTIALLY RESOLVED]

**~~Request schemas are NOT used for form validation in the frontend.~~**

### Status: PARTIALLY RESOLVED (November 2025)

Major frontend forms now use shared Zod schemas for validation:

| Form | Status | Schema Used |
|------|--------|-------------|
| LoginPage | **Migrated** | `EmailSchema` |
| ResetPasswordPage | **Migrated** | `EmailSchema` |
| RegisterPage | **Migrated** | `RegisterRequestSchema` |
| ExpenseFormStore | **Migrated** | `ExpenseFormFieldsSchema` (local, uses `CurrencyCodeSchema`) |

### What Was Changed

**Auth Pages** - Now use `EmailSchema` and `RegisterRequestSchema` from shared package instead of manual checks.

**ExpenseFormStore** - Created `ExpenseFormFieldsSchema` for simple fields (description, amount, currency, label, paidBy). Complex split validation remains manual by design due to currency-aware math requirements.

### Remaining Manual Validation

- **Expense splits** - Complex EQUAL/EXACT/PERCENTAGE calculations with currency precision
- **Date validation** - Form uses local date (YYYY-MM-DD), schema expects UTC ISO format
- **Participants** - Simple array length check (trivial)

### Impact Reduction
- Auth forms: Full schema coverage
- Expense forms: ~70% schema coverage (simple fields migrated, complex splits manual)

---

## 7. Local Schema Definitions in Frontend [RESOLVED ✅]

**~~`webapp-v2/src/app/apiClient.ts` defines local Zod schemas instead of using shared.~~**

### Status: RESOLVED (November 2025)

Investigation found **no local schemas** in `apiClient.ts`. All schemas are centralized in `packages/shared/src/schemas/apiSchemas.ts`. The report was outdated - the codebase already follows the correct pattern.

The `apiClient.ts` file:
- Imports `ApiErrorResponseSchema` and `responseSchemas` from shared package
- Uses centralized `responseSchemas` registry for endpoint validation
- Contains no local schema definitions

---

## 8. Error Response Format Inconsistency [RESOLVED ✅]

**~~Two different error formats are supported.~~**

### Status: RESOLVED (November 2025)

The schema now enforces structured format only. Server always generated structured format; the dual-format schema was defensive code that's no longer needed.

### Changes Made

**`packages/shared/src/schemas/apiSchemas.ts`** - Simplified schema:
```typescript
// Before: z.union([...structured, ...simple])
// After:
export const ApiErrorResponseSchema = z.object({
    error: z.object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z.unknown().optional(),
    }),
});
```

**`webapp-v2/src/app/apiClient.ts`** - Simplified error parsing:
```typescript
// Before: typeof check for object vs string
// After: Direct extraction
const { code, message, details } = errorResult.data.error;
throw new ApiError(message, code, details, {...});
```

**`e2e-tests/.../error-handling-comprehensive.e2e.test.ts`** - Updated 3 test mocks to structured format

### Tests Updated
- `packages/shared/src/__tests__/unit/api-schemas.test.ts` - Tests now verify simple format is rejected

---

## 9. Inline Validation in Handlers [RESOLVED ✅]

**~~Some handlers have inline validation instead of using centralized validators.~~**

### Status: RESOLVED (November 2025)

Both handlers migrated to centralized validators using `createRequestValidator` pattern.

### Changes Made

**ActivityHandlers.ts:**
- Added `ActivityFeedQuerySchema` to shared package
- Created `validateActivityFeedQuery` using `createRequestValidator`
- Removed manual `parseQuery` method
- Invalid `?limit=abc` now throws `INVALID_QUERY_PARAMS` (previously silent default)

**TenantAdminHandlers.ts:**
- Added `UploadTenantAssetParamsSchema` for params validation
- Created `validateUploadTenantAssetParams` using `createRequestValidator`
- Removed inline if-statement for assetType validation
- Image validation utilities (`validateLogoImage`/`validateFaviconImage`) unchanged (already well-encapsulated)

---

## 10. Query Parameter Validation Gaps [RESOLVED ✅]

**~~Query parameters not consistently validated with schemas.~~**

### Status: RESOLVED (November 2025)

All list endpoints now use Zod schemas with `createRequestValidator` pattern.

### Endpoints Updated

| Endpoint | Schema | Notes |
|----------|--------|-------|
| Comments list | ✅ `ListCommentsQuerySchema` | Already done |
| Activity feed | ✅ `ActivityFeedQuerySchema` | Done in item #9 |
| Groups list | ✅ `ListGroupsQuerySchema` | New - includes order + statusFilter |
| Group full details | ✅ `GroupFullDetailsQuerySchema` | New - multiple pagination cursors |
| Expenses list | ✅ `ListExpensesQuerySchema` | New endpoint: `GET /groups/:groupId/expenses` |
| Settlements list | ✅ `ListSettlementsQuerySchema` | New endpoint: `GET /groups/:groupId/settlements` |
| Users list (Auth) | ✅ `ListAuthUsersQuerySchema` | Admin endpoint - supports email/uid filter |
| Users list (Firestore) | ✅ `ListFirestoreUsersQuerySchema` | Admin endpoint - supports email/uid/displayName filter |

### Files Changed

**Shared Package:**
- `packages/shared/src/schemas/apiRequests.ts` - Added 6 new query schemas

**Groups Module:**
- `firebase/functions/src/groups/validation.ts` - Added `validateListGroupsQuery`, `validateGroupFullDetailsQuery`
- `firebase/functions/src/groups/GroupHandlers.ts` - Updated `listGroups`, `getGroupFullDetails` to use validators

**Browser Module (Admin):**
- `firebase/functions/src/browser/validation.ts` - NEW FILE with `validateListAuthUsersQuery`, `validateListFirestoreUsersQuery`
- `firebase/functions/src/browser/UserBrowserHandlers.ts` - Updated to use validators

**Expenses Module:**
- `firebase/functions/src/expenses/validation.ts` - Added `validateListExpensesQuery`, `validateGroupIdParam`
- `firebase/functions/src/expenses/ExpenseHandlers.ts` - Added `listGroupExpenses` handler

**Settlements Module:**
- `firebase/functions/src/settlements/validation.ts` - Added `validateListSettlementsQuery`, `validateGroupIdParam`
- `firebase/functions/src/settlements/SettlementHandlers.ts` - Added `listGroupSettlements` handler

**Routes:**
- `firebase/functions/src/routes/route-config.ts` - Added 2 new routes

### Tests Added

- `groups-validation.test.ts` - 16 tests
- `browser-validation.test.ts` - 19 tests
- `expenses-list-validation.test.ts` - 15 tests
- `settlements-list-validation.test.ts` - 15 tests

**Total: 65 new unit tests**

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

### Immediate (Critical) - ALL RESOLVED ✅
1. ~~Add response validation middleware that validates all responses before sending~~ → DONE (November 2025)
2. ~~Add schema contract tests for all endpoints~~ → DONE (commit 2bd04f1b)
3. ~~Apply sanitization consistently to all update operations~~ → DONE (November 2025)

### Short-term (High Priority) - ALL RESOLVED ✅
4. ~~Create Zod schemas for all missing response types~~ → DONE (November 2025)
5. ~~Migrate groups module to modern `createRequestValidator` pattern~~ → DONE (November 2025)
6. ~~Integrate shared request schemas into frontend form validation~~ → PARTIALLY DONE (November 2025 - auth + expense simple fields)
7. ~~Fix amount precision validation gaps~~ → DONE (November 2025)

### Medium-term (Important)
8. ~~Standardize error response format~~ → DONE (November 2025)
9. ~~Add query parameter schemas for all list endpoints~~ → DONE (November 2025)
10. ~~Enforce pagination limits (min/max bounds)~~ → DONE (November 2025)
11. ~~Move inline validation to centralized validators~~ → DONE (November 2025 - items #9 and #10)

