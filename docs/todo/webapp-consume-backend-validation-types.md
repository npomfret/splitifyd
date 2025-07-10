# Webapp Issue: Consume Backend API Validation Types

## Issue Description

The backend is implementing a robust, schema-driven validation layer for all incoming data using Zod. The frontend (`webapp`) needs to leverage the inferred TypeScript types from these Zod schemas to ensure full type safety throughout the application, from the API boundary to the UI.

## Recommendation

Utilize the TypeScript types inferred from the backend's Zod schemas in the webapp. This will improve type safety, reduce runtime errors, and align the frontend's understanding of data structures with the backend's authoritative definitions.

## Implementation Suggestions

This issue is a direct follow-up to the backend's API Data Validation Plan (`docs/todo/api-data-validation-plan.md`) and is closely related to the `webapp-client-server-data-integrity.md` issue.

1.  **Shared Type Generation (Backend Responsibility):**
    *   The backend development team should ensure that the Zod schemas defined in `firebase/functions/src/models/` are used to infer TypeScript types.
    *   Ideally, these types should be made available to the frontend in a shared location (e.g., `packages/shared-types` as proposed in `webapp-client-server-data-integrity.md`). This might involve a build step in the backend to generate and copy these types.

2.  **Update Webapp Type Definitions:**
    *   Once the shared types are available, update the `webapp/src/js/types/api.d.ts` and `webapp/src/js/types/business-logic.d.ts` files to import and use these shared types.
    *   This will replace the manually defined interfaces with the automatically inferred ones, ensuring consistency.

3.  **Refactor Webapp Code to Use New Types:**
    *   Go through the webapp codebase and update all references to API data structures to use the newly imported shared types.
    *   This will help identify any discrepancies between the frontend's current assumptions and the backend's validated data structures.

4.  **Client-Side Validation (Optional but Recommended):**
    *   While the backend provides authoritative validation, consider implementing client-side validation using a library like Zod (as discussed in `webapp-client-server-data-integrity.md`).
    *   If the shared types are used to generate Zod schemas for the frontend, this can provide immediate user feedback and reduce unnecessary network requests for invalid data.

**Next Steps:**
1.  Coordinate with the backend team to establish a mechanism for sharing the inferred TypeScript types from their Zod schemas.
2.  Update the webapp's type definitions to consume these shared types.
3.  Refactor webapp code to align with the new, authoritative type definitions.
