# API Inconsistency and Duplication Report

> **Last Updated:** November 2025 - All issues resolved (#1-9)

### Summary of Findings

The investigation reveals several significant inconsistencies and gaps in the project's API layer. The core issues stem from a lack of consistent standards that are then propagated from the backend to the frontend.

### Recent Improvements (November 2025)

- **Tenant Model Simplified:** `primaryDomain` field removed from tenant model (commit 2bd04f1b). The `domains` array is now the single source of truth for tenant domain configuration.
- **Schema Testing Added:** Comprehensive API schema validation tests added to catch schema/response mismatches.
- **Route Parameter Naming Standardized:** All route parameters now use resource-specific names consistently:
  - `:id` → `:groupId` (for group routes)
  - `:id` → `:expenseId` (for expense routes)
  - `:id` → `:policyId` (for policy routes)
  - `:uid` → `:userId` (for admin user routes)
  - Frontend normalization logic simplified from 7 special-case patterns to 6 generic replacements.
- **Validation Patterns Standardized:** Commit `a9b18242` migrated all validation to the `createRequestValidator` pattern. All 9 validation files now use consistent error handling with `createZodErrorMapper` for field-specific error messages.
- **Schema Duplication Removed:** Deleted local `ListFirestoreUsersResponseSchema` from `webapp-v2/src/app/apiClient.ts`. The endpoint now uses the shared schema from `apiSchemas.ts`. Also removed obsolete `id` → `uid` field mapping (backend already returns `uid`).
- **Schema Coverage Completed:** Added 18 new endpoint schemas to `apiSchemas.ts`:
  - Group member management: permissions, archive, unarchive, pending members, role updates, approve/reject
  - Admin policy: list, get single, get version, delete version
  - Admin user: auth record, firestore record for single user
  - Admin tenant: create/update, asset uploads
  - Group preview endpoint
- **joinGroupByLink Signature Fixed:** Removed ambiguous `displayNameOrToken?: DisplayName | AuthToken` parameter. The new signature is clear: `joinGroupByLink(shareToken, groupDisplayName, token?)`.
- **JoinGroupResponse success Field Removed:** Removed the redundant `success: boolean` field from `JoinGroupResponse`. The `memberStatus` field (`'active'` | `'pending'`) now conveys whether the user was auto-approved or requires admin approval. HTTP status codes indicate request success/failure.
- **Cloud Tasks OIDC Authentication Added:** The `/tasks/processMerge` endpoint now uses proper OIDC token verification via the `authenticateCloudTask` middleware. Cloud Tasks is configured to send OIDC tokens signed by the project's service account, and the middleware verifies these tokens in production (skipped in emulator mode).
- **Error Response Schema Standardized:** Commit `3076bcd2` enforced structured-only API error format. The schema now only accepts `{ error: { code, message, details } }`. The legacy `{ error: string, field? }` format was removed.
- **Update/Delete Return Types Standardized:** All update and delete operations now return HTTP 204 No Content (void). This follows REST best practices where mutations that don't need to return data use 204. The frontend now re-fetches data when needed (which it was already doing via `refreshAll()`). This eliminates the inconsistency between methods returning `MessageResponse`, full resource DTOs, or other variations.

1.  ~~**Inconsistent Endpoint Naming:**~~ **RESOLVED.** Route parameters are now consistently named across all endpoints (`:groupId`, `:expenseId`, `:policyId`, `:userId`, `:settlementId`, `:memberId`). The frontend client normalization logic has been simplified accordingly.

2.  ~~**Inconsistent Error Handling:**~~ **RESOLVED.** All 9 validation files now use the consistent `createRequestValidator` pattern with `createZodErrorMapper` for field-specific error messages (commit `a9b18242`). The legacy `parseWithApiError` function has been deprecated.

3.  ~~**Incomplete Schema Coverage:**~~ **RESOLVED.** All API endpoints now have response schemas in `apiSchemas.ts`. Added schemas for group member management (permissions, archive, unarchive, pending, role, approve, reject), admin policy CRUD, admin user record fetching, admin tenant operations, and group preview.

4.  ~~**Schema Duplication:**~~ **RESOLVED.** Removed local `ListFirestoreUsersResponseSchema` from `apiClient.ts`. The endpoint now uses the shared schema.

5.  ~~**Potential Security Gap:**~~ **RESOLVED.** The `/tasks/processMerge` endpoint now uses the `authenticateCloudTask` middleware which verifies OIDC tokens from Cloud Tasks. The MergeService configures Cloud Tasks to send OIDC tokens signed by the project's service account. In emulator mode, the middleware skips verification since the StubCloudTasksClient doesn't send real tokens.

In summary, the API layer is now fully standardized. All issues (#1-9) are resolved: route parameter naming, validation patterns, schema coverage, schema location, Cloud Tasks security, ambiguous method signatures, redundant response fields, error format standardization, and update/delete return type consistency.
---

### 6. API Contract Inconsistencies (`packages/shared/src/api.ts`)

A direct analysis of the API's TypeScript interfaces reveals inconsistencies in the API's *contract*, before it is even implemented.

*   ~~**Inconsistent Identifier Naming:**~~ **RESOLVED.** Route parameters now use consistent resource-specific naming (`:groupId`, `:expenseId`, `:policyId`, `:userId`). The frontend normalization logic has been simplified.

*   ~~**Ambiguous Method Signature:**~~ **RESOLVED.** The `joinGroupByLink` signature has been clarified to `joinGroupByLink(shareToken: ShareLinkToken, groupDisplayName: DisplayName, token?: AuthToken)`. The ambiguous `displayNameOrToken` parameter was removed.

*   ~~**Inconsistent Return Types on Updates:**~~ **RESOLVED.** All update and delete operations now return `Promise<void>` (HTTP 204 No Content). This follows REST best practices where mutations that don't need to return data simply return a 204 status code. The frontend re-fetches data when needed, which aligns with its existing `refreshAll()` pattern.
---

### 7. Deep Dive: API Response Strategy (Success, Failure, and Errors)

A detailed look at how the API communicates outcomes reveals significant inconsistencies at the contract level.

*   ~~**Inconsistent Error Response Schema:**~~ **RESOLVED.** Commit `3076bcd2` enforced structured-only API error format. The `ApiErrorResponseSchema` now only accepts the structured format `{ error: { code, message, details } }`. The legacy `{ error: string, field? }` format was removed.

*   ~~**Redundant Frontend Error Handling:**~~ **RESOLVED.** With the schema standardized, the frontend only needs to handle one error format. The defensive parsing of legacy formats is no longer needed.

*   ~~**Inconsistent Success Payloads on Update:**~~ **RESOLVED.** All update operations now return HTTP 204 No Content. The frontend re-fetches data when needed, aligning with its existing `refreshAll()` pattern. This eliminates the need for special handling of different return types.

*   ~~**Anti-Pattern in `JoinGroupResponseSchema`:**~~ **RESOLVED.** Removed the `success: boolean` field from `JoinGroupResponse`. HTTP status codes now indicate success/failure. The `memberStatus` field (`'active'` | `'pending'`) conveys whether the user was auto-approved or requires admin approval.
