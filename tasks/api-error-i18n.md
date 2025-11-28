# API Error Message Internationalization

API error messages (e.g., "Authentication required", "Access denied", "Group not found") are hardcoded in English in `firebase/functions/src/utils/errors.ts` and throughout the backend.

These messages are displayed directly to users in the frontend UI.

**Problem:** Users in non-English locales see English error messages.

**Scope:** Determine strategy for translating API error messages to support i18n.

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

Add error translations to `webapp-v2/src/locales/{lng}/translation.json`:

```json
{
  "apiErrors": {
    "UNAUTHORIZED": "Please sign in to continue",
    "INVALID_TOKEN": "Your session has expired. Please sign in again.",
    "FORBIDDEN": "You don't have permission to do this",
    "NOT_FOUND": "{{resource}} not found",
    "ALREADY_EXISTS": "{{resource}} already exists",
    "INVALID_INPUT": "Please check your input and try again",
    "MISSING_FIELD": "{{field}} is required",
    "CONCURRENT_UPDATE": "Someone else updated this. Please refresh and try again.",
    "INTERNAL_ERROR": "Something went wrong. Please try again.",
    "DATABASE_ERROR": "Unable to save your changes. Please try again."
  }
}
```

### Implementation Steps

1. **Update `Errors` factory** - Ensure all errors include interpolation data (e.g., `resource`, `field`) in the `details` object

2. **Create error translation helper** - Build a utility that maps API error responses to localized strings:
   ```typescript
   function translateApiError(error: ApiErrorResponse, t: TFunction): string {
     return t(`apiErrors.${error.code}`, error.details);
   }
   ```

3. **Update error display components** - Use the helper wherever API errors are shown to users

4. **Remove backend i18n infrastructure** - Delete `firebase/functions/src/locales/` and remove i18next from backend dependencies (it's currently unused for error responses anyway)

### Error Code Inventory

Current error codes in `firebase/functions/src/utils/errors.ts`:

| Code | Current Message | Interpolation Params |
|------|-----------------|---------------------|
| `UNAUTHORIZED` | "Authentication required" | - |
| `INVALID_TOKEN` | "Invalid authentication token" | - |
| `FORBIDDEN` | "Access denied" | - |
| `INVALID_INPUT` | "Invalid input data" | `details` object |
| `MISSING_FIELD` | "Missing required field: {field}" | `field` |
| `DOCUMENT_TOO_LARGE` | "Document exceeds maximum size of 1MB" | - |
| `NOT_FOUND` | "{resource} not found" | `resource` |
| `ALREADY_EXISTS` | "{resource} already exists" | `resource` |
| `CONCURRENT_UPDATE` | "Document was modified..." | - |
| `INTERNAL_ERROR` | "An internal error occurred" | - |
| `DATABASE_ERROR` | "Database operation failed" | - |

### What NOT to Do

- **Don't localize on the backend** - Adds complexity, duplicates translation files, prevents dynamic language switching
- **Don't include a `message` field** - No legacy clients to support; keep API responses lean
- **Don't use `Accept-Language` header** - The frontend knows the user's language preference; no need to pass it to the API

### References

- [Stack Overflow: Frontend vs Backend i18n](https://stackoverflow.com/questions/30109787/internationalization-of-api-error-messages-on-front-end-or-back-end)
- [API Craft: REST API Error Localization](https://groups.google.com/g/api-craft/c/U6JMr26Ew6k)
- [Stack Overflow: REST Services and I18N](https://stackoverflow.com/questions/6544077/best-practice-regarding-rest-services-and-i18n)

---

## Complete Error Code Inventory (Audit Result)

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