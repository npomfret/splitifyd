# API Inconsistency and Duplication Report

> **Last Updated:** November 2025 - Issues #1, #2, #4 resolved; Issue #3 assessed in detail

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

1.  ~~**Inconsistent Endpoint Naming:**~~ **RESOLVED.** Route parameters are now consistently named across all endpoints (`:groupId`, `:expenseId`, `:policyId`, `:userId`, `:settlementId`, `:memberId`). The frontend client normalization logic has been simplified accordingly.

2.  ~~**Inconsistent Error Handling:**~~ **RESOLVED.** All 9 validation files now use the consistent `createRequestValidator` pattern with `createZodErrorMapper` for field-specific error messages (commit `a9b18242`). The legacy `parseWithApiError` function has been deprecated.

3.  **Incomplete Schema Coverage:** Several API endpoints are missing response schemas in `apiSchemas.ts`. Missing schemas include:
    - Group member management: `PUT /groups/:groupId/security/permissions`, `POST /groups/:groupId/archive`, `POST /groups/:groupId/unarchive`, `GET /groups/:groupId/members/pending`, `PUT /groups/:groupId/members/:memberId/role`, `POST /groups/:groupId/members/:memberId/approve`, `POST /groups/:groupId/members/:memberId/reject`
    - Admin policy: `GET /admin/policies` (list), `GET /admin/policies/:policyId`, `GET /admin/policies/:policyId/versions/:hash`, `DELETE /admin/policies/:policyId/versions/:hash`
    - Admin user: `GET /admin/users/:userId/auth`, `GET /admin/users/:userId/firestore`
    - Admin tenant: `POST /admin/tenants`, `POST /admin/tenants/:tenantId/assets/:assetType`
    - Group preview: `GET /groups/preview`

    Note: Merge and policy create/update/publish schemas were added in commit `a9b18242`.

4.  ~~**Schema Duplication:**~~ **RESOLVED.** Removed local `ListFirestoreUsersResponseSchema` from `apiClient.ts`. The endpoint now uses the shared schema.

5.  **Potential Security Gap:** The `/tasks/processMerge` endpoint relies on cloud infrastructure for authorization, as noted by a comment in `route-config.ts`. This deviates from the consistent application-level middleware pattern (`authenticate`, `authenticateAdmin`) used elsewhere and could be a point of failure if the infrastructure is misconfigured.

In summary, the API layer has made good progress on standardization (route parameter naming, validation patterns, and schema location are now consistent), but still has issues with schema coverage for admin endpoints and response format consistency that create technical debt.
---

### 6. API Contract Inconsistencies (`packages/shared/src/api.ts`)

A direct analysis of the API's TypeScript interfaces reveals inconsistencies in the API's *contract*, before it is even implemented.

*   ~~**Inconsistent Identifier Naming:**~~ **RESOLVED.** Route parameters now use consistent resource-specific naming (`:groupId`, `:expenseId`, `:policyId`, `:userId`). The frontend normalization logic has been simplified.

*   **Ambiguous Method Signature:** The `joinGroupByLink` method has a confusing signature: `joinGroupByLink(shareToken: ShareLinkToken, displayNameOrToken?: DisplayName | AuthToken, token?: AuthToken)`. The presence of two optional parameters that could both be an `AuthToken` is ambiguous and likely a bug or a remnant of an incomplete refactoring.

*   **Inconsistent Return Types on Updates:** There is no consistent pattern for the return value of update operations.
    *   Some methods, like `updateExpense`, return the entire updated resource (`Promise<ExpenseDTO>`).
    *   Others, like `updateGroup`, return a generic success message (`Promise<MessageResponse>`).
    This forces the frontend to handle mutation responses differently depending on the endpoint, adding complexity to state management.
---

### 7. Deep Dive: API Response Strategy (Success, Failure, and Errors)

A detailed look at how the API communicates outcomes reveals significant inconsistencies at the contract level.

*   **Inconsistent Error Response Schema:** The core schema for API errors, `ApiErrorResponseSchema`, officially defines two different shapes for an error payload: a "structured" preferred format (`{ error: { code, message } }`) and a "simple" legacy format (`{ error: string, field?: string }`). The existence of two different error contracts is a major source of complexity.

*   **Redundant Frontend Error Handling:** The frontend `apiClient.ts` is forced to defensively handle both of these error formats. While it successfully normalizes them into a single, consistent `ApiError` class for the rest of the application, this client-side complexity is redundant and only exists to work around the backend's lack of a single error standard.

*   **Inconsistent Success Payloads on Update:** As noted previously, the API is inconsistent in what it returns for a successful `update` operation. Some endpoints return the full, updated resource, while others return a generic `MessageResponse`. This complicates frontend state management, as the client cannot rely on a single pattern for updating its local cache after a mutation.

*   **Anti-Pattern in `JoinGroupResponseSchema`:** The schema for the "join group" response contains a `success: boolean` field. Communicating the success or failure of an API call via a boolean in a 200 OK response body is an anti-pattern. The HTTP status code itself should indicate the outcome (e.g., 2xx for success, 4xx/5xx for failure), with the response body for a failure conforming to the defined error schema.
