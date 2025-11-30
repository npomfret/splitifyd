# API Error Message Internationalization

**Status:** 🔄 PHASE 3 PENDING (November 2025)

**Prerequisite:** `error-code-consolidation.md` (complete - DELETE THIS FILE)

**Problem:** API error messages were hardcoded in English. Users in non-English locales would see English error messages.

**Solution:** Client-side localization using error codes. The API returns structured error data with codes and interpolation parameters. The frontend translates using the `apiErrors` namespace.

**Current State:**
- ✅ Backend infrastructure complete (new error system in `firebase/functions/src/errors/`)
- ✅ Backend migration complete - all handlers/services use `errors/` module
- ✅ Legacy `utils/errors.ts` deleted
- ✅ All backend tests updated to use two-tier error format
- ✅ `apiErrors` namespace exists in `webapp-v2/src/locales/en/translation.json`
- ❌ **Frontend NOT using translations** - components still use raw `error.message`
- ❌ **No `translateApiError` helper** - this is REQUIRED, not optional
- ❌ **Hardcoded English strings** in stores and pages

---

## Recommendation: Client-Side Localization

After researching best practices, the recommended approach is **frontend-only translation using error codes**.

### Why Client-Side?

1. **Single source of truth** - All translations live in one place (`webapp-v2/src/locales/`), eliminating duplication with `firebase/functions/src/locales/`

2. **Formatting flexibility** - Error messages in UI often need styling (bold, links, icons) that's impossible if the backend returns plain text

3. **Dynamic language switching** - Users can change language instantly without new API calls

4. **Simpler backend** - No i18next dependency needed in Cloud Functions, faster cold starts

5. **Faster iteration** - Translation updates don't require backend redeployment

6. **Already aligned** - Frontend already uses i18next extensively; this extends the existing pattern

### API Response Format

The API returns structured error data with codes and interpolation parameters:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "resource": "Group"
  }
}
```

- `code` - Machine-readable error identifier (used for translation lookup)
- `resource` / other fields - Dynamic data for interpolation

No `message` field needed - the frontend handles all user-facing text.

### Frontend Translation Structure

Error translations in `webapp-v2/src/locales/{lng}/translation.json`:

```json
{
  "apiErrors": {
    "AUTH_REQUIRED": "Please sign in to continue",
    "AUTH_INVALID": "Your session has expired. Please sign in again.",
    "FORBIDDEN": "You don't have permission to do this",
    "NOT_FOUND": "{{resource}} not found",
    "ALREADY_EXISTS": "{{resource}} already exists",
    "CONFLICT": "Someone else made changes. Please refresh and try again.",
    "VALIDATION_ERROR": "Please check your input and try again",
    "INVALID_REQUEST": "Something went wrong with your request",
    "RATE_LIMITED": "Too many requests. Please wait a moment.",
    "SERVICE_ERROR": "Something went wrong. Please try again.",
    "UNAVAILABLE": "Service temporarily unavailable. Please try again later."
  }
}
```

### Implementation Steps

1. ✅ **Updated `Errors` factory** - All errors include interpolation data (`resource`, `field`, `detail`) in the data object

2. ❌ **Create error translation helper** (REQUIRED) - Build a utility that maps API error responses to localized strings:
   ```typescript
   function translateApiError(error: ApiErrorResponse, t: TFunction): string {
     return t(`apiErrors.${error.code}`, error);
   }
   ```

3. ❌ **Update error display components** - Components still use raw `error.message` instead of translations

4. ✅ **Removed backend i18n infrastructure** - Deleted `firebase/functions/src/locales/`, `utils/i18n.ts`, and removed i18next dependencies

### Current Error Codes

The new error system in `firebase/functions/src/errors/` uses these Tier 1 category codes:

| Code | HTTP Status | Interpolation Params |
|------|-------------|---------------------|
| `AUTH_REQUIRED` | 401 | - |
| `AUTH_INVALID` | 401 | `detail` |
| `FORBIDDEN` | 403 | `detail` |
| `NOT_FOUND` | 404 | `resource`, `detail`, `resourceId` |
| `ALREADY_EXISTS` | 409 | `resource`, `detail` |
| `CONFLICT` | 409 | `detail` |
| `VALIDATION_ERROR` | 400 | `field`, `fields`, `detail` |
| `INVALID_REQUEST` | 400 | `detail` |
| `RATE_LIMITED` | 429 | - |
| `SERVICE_ERROR` | 500 | `detail` |
| `UNAVAILABLE` | 503 | `detail` |

### What NOT to Do

- **Don't localize on the backend** - Adds complexity, duplicates translation files, prevents dynamic language switching
- **Don't include a `message` field** - No legacy clients to support; keep API responses lean
- **Don't use `Accept-Language` header** - The frontend knows the user's language preference; no need to pass it to the API

### References

- [Stack Overflow: Frontend vs Backend i18n](https://stackoverflow.com/questions/30109787/internationalization-of-api-error-messages-on-front-end-or-back-end)
- [API Craft: REST API Error Localization](https://groups.google.com/g/api-craft/c/U6JMr26Ew6k)
- [Stack Overflow: REST Services and I18N](https://stackoverflow.com/questions/6544077/best-practice-regarding-rest-services-and-i18n)

---

## Implementation Summary

### Phase 1 - Infrastructure (Complete)
1. ✅ **Consolidated error codes** - ~115 codes → ~12 category codes (Tier 1) + 52 detail codes (Tier 2)
2. ✅ **Created new error system** - `firebase/functions/src/errors/` with `ErrorCode`, `ApiError`, and `Errors` factory
3. ✅ **Added frontend translations** - `webapp-v2/src/locales/en/translation.json` has `apiErrors` namespace
4. ✅ **Removed backend i18n** - Deleted `utils/i18n.ts`, `locales/` directory, and i18next dependencies

### Phase 2 - Backend Migration (Complete)
1. ✅ **Migrated all production files** - All handlers, services, and middleware now use `errors/` module
2. ✅ **Migrated all test files** - Test assertions updated to use new `ErrorCode` enum
3. ✅ **Deleted legacy code** - Removed `utils/errors.ts` and dual error handling in `index.ts`

### Phase 3 - Frontend Migration (PENDING)

**Problem:** The `apiErrors` namespace exists but frontend components don't use it. They still use raw `error.message` strings.

#### 3.1 Create `translateApiError` helper

**File:** `webapp-v2/src/utils/error-translation.ts`

```typescript
import type { TFunction } from 'i18next';
import { ApiError } from '@/app/apiClient';

export function translateApiError(
  error: unknown,
  t: TFunction,
  fallback?: string
): string {
  if (error instanceof ApiError) {
    const translated = t(`apiErrors.${error.code}`, {
      ...error.details,
      defaultValue: ''
    });
    if (translated) return translated;
  }
  return fallback ?? t('common.unknownError');
}
```

#### 3.2 Add missing translations

**File:** `webapp-v2/src/locales/en/translation.json`

Add Firebase auth errors (currently hardcoded in auth-store.ts):
```json
{
  "authErrors": {
    "userNotFound": "No account found with this email",
    "wrongPassword": "Incorrect password",
    "weakPassword": "Password is too weak",
    "invalidEmail": "Please enter a valid email address",
    "tooManyRequests": "Too many attempts. Please try again later.",
    "networkError": "Network error. Please check your connection.",
    "emailInUse": "This email is already registered"
  },
  "common": {
    "unknownError": "Something went wrong. Please try again."
  }
}
```

#### 3.3 Migrate stores (4 files)

| Store | Issue | Lines |
|-------|-------|-------|
| `auth-store.ts` | Hardcoded Firebase error messages | 522-549 |
| `join-group-store.ts` | Hardcoded link error messages | 107-113 |
| `expense-form-store.ts` | Uses raw `error.message` | 1165-1172 |
| `activity-feed-store.ts` | Uses raw `error.message` | 124 |

#### 3.4 Migrate pages (4 files)

| Page | Issue | Lines |
|------|-------|-------|
| `JoinGroupPage.tsx` | Hardcoded name validation + API errors | 81-93, 102-106 |
| `SettingsPage.tsx` | Hardcoded validation messages | 110-127, 147-150 |
| `RegisterPage.tsx` | Partial - verify completeness | various |
| `ResetPasswordPage.tsx` | Verify uses translations | 42-44 |

#### 3.5 Migrate components (4 files)

| Component | Issue |
|-----------|-------|
| `GroupSettingsModal.tsx` | Multiple error states use raw messages |
| `CreateGroupModal.tsx` | Checks `error.code` but uses fallback message |
| `CommentInput.tsx` | Catch block uses raw message |
| `SettlementForm.tsx` | Verify uses translations |

---

## Frontend Error Handling Audit (November 2025)

### Audit Summary

| Category | Count | Status |
|----------|-------|--------|
| Stores with hardcoded errors | 4 | ❌ Need migration |
| Pages with hardcoded errors | 4 | ❌ Need migration |
| Components with hardcoded errors | 4 | ❌ Need migration |
| `apiErrors` translations | 12 | ✅ Exist but unused |
| `translateApiError` helper | 0 | ❌ Does not exist |

### Error Patterns Found

**Pattern 1: Raw error.message usage**
```typescript
// Found in: expense-form-store.ts, activity-feed-store.ts, CommentInput.tsx
const message = error instanceof Error ? error.message : 'Unknown error';
```

**Pattern 2: Error code checking with hardcoded fallback**
```typescript
// Found in: join-group-store.ts, JoinGroupPage.tsx, CreateGroupModal.tsx
if (error.code === 'DISPLAY_NAME_CONFLICT') {
  setError(error.message || 'This name is already in use');  // Hardcoded!
}
```

**Pattern 3: Firebase auth errors (completely hardcoded)**
```typescript
// Found in: auth-store.ts lines 522-549
switch (error.code) {
  case 'auth/user-not-found':
    return 'No account found with this email';  // Hardcoded!
  case 'auth/wrong-password':
    return 'Incorrect password';  // Hardcoded!
  // ... 6 more hardcoded cases
}
```

**Pattern 4: Validation errors (hardcoded)**
```typescript
// Found in: SettingsPage.tsx, JoinGroupPage.tsx
if (displayName.length < 2) {
  setError('Display name must be at least 2 characters');  // Hardcoded!
}
```

### Backend Error System Reference

The backend provides well-structured errors that the frontend should translate:

**Tier 1 Category Codes (12):**
`AUTH_REQUIRED`, `AUTH_INVALID`, `FORBIDDEN`, `NOT_FOUND`, `ALREADY_EXISTS`, `CONFLICT`, `VALIDATION_ERROR`, `INVALID_REQUEST`, `RATE_LIMITED`, `SERVICE_ERROR`, `UNAVAILABLE`

**Tier 2 Detail Codes (52+):**
Used for debugging/logging, not for translation. Examples: `GROUP_NOT_FOUND`, `INVALID_AMOUNT`, `DISPLAY_NAME_TAKEN`, `TOKEN_EXPIRED`

**Error Response Structure:**
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

### Files to Modify (Complete List)

| File | Type | Priority |
|------|------|----------|
| `webapp-v2/src/utils/error-translation.ts` | CREATE | HIGH |
| `webapp-v2/src/locales/en/translation.json` | UPDATE | HIGH |
| `webapp-v2/src/app/stores/auth-store.ts` | UPDATE | HIGH |
| `webapp-v2/src/app/stores/join-group-store.ts` | UPDATE | HIGH |
| `webapp-v2/src/app/stores/expense-form-store.ts` | UPDATE | MEDIUM |
| `webapp-v2/src/app/stores/activity-feed-store.ts` | UPDATE | MEDIUM |
| `webapp-v2/src/pages/JoinGroupPage.tsx` | UPDATE | HIGH |
| `webapp-v2/src/pages/SettingsPage.tsx` | UPDATE | HIGH |
| `webapp-v2/src/pages/RegisterPage.tsx` | UPDATE | LOW |
| `webapp-v2/src/pages/ResetPasswordPage.tsx` | UPDATE | LOW |
| `webapp-v2/src/components/group/GroupSettingsModal.tsx` | UPDATE | MEDIUM |
| `webapp-v2/src/components/dashboard/CreateGroupModal.tsx` | UPDATE | MEDIUM |
| `webapp-v2/src/components/comments/CommentInput.tsx` | UPDATE | LOW |
| `webapp-v2/src/components/settlements/SettlementForm.tsx` | UPDATE | LOW |

---

## Complete Error Code Inventory (Historical - Pre-Consolidation)

This is the comprehensive list of unique error codes found during the codebase audit.

### From the `Errors` factory:
-   `UNAUTHORIZED`
-   `INVALID_TOKEN`
-   `FORBIDDEN`
-   `INVALID_INPUT`
-   `MISSING_FIELD`
-   `DOCUMENT_TOO_LARGE`
-   `NOT_FOUND`
-   `ALREADY_EXISTS`
-   `CONCURRENT_UPDATE`
-   `INTERNAL_ERROR`
-   `DATABASE_ERROR`

### From direct `new ApiError(...)` instantiations:
-   `ACCESS_DENIED`
-   `ALREADY_DELETED`
-   `ALREADY_MEMBER`
-   `AUTH_CONFIGURATION_ERROR`
-   `AUTH_REQUIRED`
-   `AUTH_TOKEN_HAS_EXPIRED`
-   `AUTH_UNKNOWN_ERROR`
-   `BALANCE_NOT_FOUND`
-   `BALANCE_READ_ERROR`
-   `CANNOT_DELETE_CURRENT`
-   `CANNOT_DELETE_ONLY`
-   `COMMENT_CREATION_FAILED`
-   `CORRUPT_POLICY_DATA`
-   `DISPLAY_NAME_TAKEN`
-   `DUPLICATE_SPLIT_USERS`
-   `EMAIL_ALREADY_EXISTS`
-   `EMAIL_CHANGE_FAILED`
-   `EMAIL_UNCHANGED`
-   `EMPTY_FILE`
-   `EXPENSE_CREATION_FAILED`
-   `EXPENSE_NOT_FOUND`
-   `GROUP_AT_CAPACITY`
-   `GROUP_DISPLAY_NAME_MISSING`
-   `GROUP_MEMBER_NOT_FOUND`
-   `GROUP_NOT_FOUND`
-   `GROUP_TOO_LARGE`
-   `INSUFFICIENT_PERMISSIONS`
-   `INVALID_ARGUMENT`
-   `INVALID_AMOUNT_PRECISION`
-   `INVALID_CURSOR`
-   `INVALID_CUSTOM_CLAIMS`
-   `INVALID_EMAIL`
-   `INVALID_EMAIL_FORMAT`
-   `INVALID_EQUAL_SPLITS`
-   `INVALID_EXPENSE_DATA`
-   `INVALID_EXPIRATION`
-   `INVALID_GROUP`
-   `INVALID_GROUP_ID`
-   `INVALID_LINK`
-   `INVALID_MEMBER_ID`
-   `INVALID_PASSWORD`
-   `INVALID_PAYER`
-   `INVALID_PARTICIPANT`
-   `INVALID_PERCENTAGE_TOTAL`
-   `INVALID_REQUEST`
-   `INVALID_SHARELINK_DATA`
-   `INVALID_SPLITS`
-   `INVALID_SPLIT_AMOUNT`
-   `INVALID_SPLIT_AMOUNT_PRECISION`
-   `INVALID_SPLIT_PERCENTAGE`
-   `INVALID_SPLIT_TOTAL`
-   `INVALID_SPLIT_USER`
-   `INVALID_TARGET_ID`
-   `INVALID_TENANT_ID`
-   `INVALID_TENANT_PAYLOAD`
-   `INVALID_UID`
-   `INVALID_VERSION_HASH`
-   `JOB_NOT_FOUND`
-   `LINK_EXPIRED`
-   `MARK_MERGED_FAILED`
-   `MERGE_EXECUTION_FAILED`
-   `MERGE_INITIATION_FAILED`
-   `MERGE_JOB_CREATE_FAILED`
-   `MERGE_JOB_FETCH_FAILED`
-   `MERGE_JOB_UPDATE_FAILED`
-   `MISSING_DISPLAY_NAME`
-   `MISSING_FILE`
-   `MISSING_LINK_ID`
-   `MISSING_SPLIT_AMOUNT`
-   `MISSING_SPLIT_PERCENTAGE`
-   `NOT_AUTHORIZED`
-   `NOT_GROUP_MEMBER`
-   `NOT_SETTLEMENT_CREATOR`
-   `NO_UPDATE_FIELDS`
-   `PAYER_NOT_PARTICIPANT`
-   `POLICIES_ACCEPT_FAILED`
-   `POLICY_CREATE_FAILED`
-   `POLICY_DATA_NULL`
-   `POLICY_EXISTS`
-   `POLICY_GET_FAILED`
-   `POLICY_LIST_FAILED`
-   `POLICY_NOT_FOUND`
-   `POLICY_PUBLISH_FAILED`
-   `POLICY_SERVICE_UNAVAILABLE`
-   `POLICY_UPDATE_FAILED`
-   `REASSIGN_FAILED`
-   `REGISTRATION_FAILURE`
-   `SERVICE_UNAVAILABLE`
-   `SETTLEMENT_NOT_FOUND`
-   `TENANT_ARTIFACT_UPDATE_FAILED`
-   `TENANT_DATA_MISSING`
-   `TENANT_NOT_FOUND`
-   `TENANT_OVERRIDE_NOT_ALLOWED`
-   `TENANT_OVERRIDE_NOT_FOUND`
-   `TENANT_TOKENS_MISSING`
-   `TENANT_UPSERT_FAILED`
-   `TOO_MANY_REQUESTS`
-   `USER_NOT_FOUND`
-   `USER_POLICY_STATUS_FAILED`
-   `VERSION_ALREADY_EXISTS`
-   `VERSION_DELETE_FAILED`
-   `VERSION_GET_FAILED`
-   `VERSION_HASH_REQUIRED`
-   `VERSION_NOT_FOUND`