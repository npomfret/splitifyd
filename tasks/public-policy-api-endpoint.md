
# Add public API endpoint for tenants to read policy files

This task is to create a new public API endpoint that allows tenants to fetch their policy documents (like Privacy Policy, Terms of Service, etc.). This enables them to display these policies on their own external websites, ensuring consistency.

## Requirements

1.  **Publicly Accessible:** The endpoint must not require user authentication.
2.  **Tenant-Scoped:** It should fetch policies for a specific tenant, likely identified by a tenant ID or a custom domain in the request URL.
3.  **Policy Identification:** The endpoint should allow fetching a specific policy document by its type (e.g., `privacy-policy`, `terms-of-service`).
4.  **Content Format:** The endpoint should return the policy content, probably as HTML or Markdown, in a JSON response.

## Implementation Plan

### Backend (Firebase)

1.  **New API Endpoint:**
    *   Create a new public route, for example: `GET /api/public/policies/:policyId`
    *   This route will live in the `PublicAPI` interface definition in `packages/shared/src/api.ts`.

2.  **Handler Logic:**
    *   The handler will need to identify the tenant from the request. This could be based on the `Origin` or `Host` header, which is mapped to a `tenantId`.
    *   It will read the `policyId` from the URL parameters.
    *   It will fetch the appropriate policy document from Firestore, located at a path like `tenants/{tenantId}/policies/{policyId}`.
    *   The content of the document should be returned in the response.

3.  **Data Structure:**
    *   Confirm the structure of policy documents in Firestore. It likely contains a `content` field with the policy text.
    *   Define a `PolicyDTO` in `packages/shared/src/shared-types.ts` for the response.

4.  **Security:**
    *   Since this is a public endpoint, ensure no sensitive information is exposed.
    *   The tenant identification mechanism must be robust.
    *   Consider rate limiting to prevent abuse.

### Frontend (Webapp)

*   No frontend changes are strictly required for this task, as the primary consumer is the tenant's external website.
*   However, it might be beneficial to update the existing webapp to use this new public endpoint for displaying its own policies, dogfooding the API.

## Task Breakdown

-   [ ] **API Definition:** Add the new `getPublicPolicy` method to the `PublicAPI` interface in `packages/shared/src/api.ts`.
-   [ ] **Types:** Define `PolicyDTO` in `packages/shared/src/shared-types.ts`.
-   [ ] **Backend:** Create the route and handler for the new public endpoint.
-   [ ] **Backend:** Implement the logic to identify the tenant and fetch the correct policy document from Firestore.
-   [ ] **Backend:** Add response schema for the new endpoint in `packages/shared/src/schemas/apiSchemas.ts`.
-   [ ] **Testing:** Write integration tests to verify the endpoint works correctly for different tenants and policy IDs.
-   [ ] **Documentation:** Update the API documentation to include this new public endpoint.
