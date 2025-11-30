# API Error Message Internationalization

**Status:** ✅ PHASE 2 COMPLETE (November 2025)

**Prerequisite:** `error-code-consolidation.md` (complete)

**Problem:** API error messages were hardcoded in English. Users in non-English locales would see English error messages.

**Solution:** Client-side localization using error codes. The API returns structured error data with codes and interpolation parameters. The frontend translates using the `apiErrors` namespace.

**Current State:**
- ✅ Infrastructure complete (new error system, frontend translations)
- ✅ Migration complete - all files use new `errors/` module
- ✅ Legacy `utils/errors.ts` deleted
- ✅ All tests updated to use two-tier error format
- ⏳ Frontend translation helper not yet created (optional enhancement)

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

### Implementation Steps (Complete)

1. ✅ **Updated `Errors` factory** - All errors include interpolation data (`resource`, `field`, `detail`) in the data object

2. ⏳ **Create error translation helper** (optional enhancement) - Build a utility that maps API error responses to localized strings:
   ```typescript
   function translateApiError(error: ApiErrorResponse, t: TFunction): string {
     return t(`apiErrors.${error.code}`, error);
   }
   ```

3. ✅ **Updated error display components** - Components now expect error codes for i18n translation

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
1. ✅ **Consolidated error codes** - ~115 codes → ~12 category codes (Tier 1) + detail codes (Tier 2)
2. ✅ **Created new error system** - `firebase/functions/src/errors/` with `ErrorCode`, `ApiError`, and `Errors` factory
3. ✅ **Added frontend translations** - `webapp-v2/src/locales/en/translation.json` has `apiErrors` namespace
4. ✅ **Removed backend i18n** - Deleted `utils/i18n.ts`, `locales/` directory, and i18next dependencies

### Phase 2 - Migration (Complete)
1. ✅ **Migrated all production files** - All handlers, services, and middleware now use `errors/` module
2. ✅ **Migrated all test files** - Test assertions updated to use new `ErrorCode` enum
3. ✅ **Deleted legacy code** - Removed `utils/errors.ts` and dual error handling in `index.ts`
4. ⏳ **Create frontend translation helper** - Utility to map API errors to localized strings (optional enhancement)

### Frontend Translation Example
```json
{
  "apiErrors": {
    "AUTH_REQUIRED": "Please sign in to continue",
    "NOT_FOUND": "{{resource}} not found",
    "VALIDATION_ERROR": "Please check your input and try again"
  }
}
```

### Error Translation Helper (To Be Created)
```typescript
function translateApiError(error: ApiErrorResponse, t: TFunction): string {
  return t(`apiErrors.${error.code}`, error);
}
```

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