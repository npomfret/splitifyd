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
