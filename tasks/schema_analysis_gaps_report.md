# Schema Usage: Gaps & Inconsistencies Report

### Executive Summary

While the project has a strong foundation for a schema-driven architecture, particularly in the `packages/shared` directory, its application is inconsistent. This has resulted in significant gaps and duplication, most notably the complete lack of shared schema usage for frontend form validation and the use of competing validation patterns on the backend.

---

### 1. Backend Inconsistencies (`firebase/functions/`)

The primary issue on the backend is the use of two different, competing validation strategies.

*   **Inconsistent Validation Patterns:**
    *   A modern, robust pattern using a `createRequestValidator` utility is found in the "expenses" feature (`src/expenses/validation.ts`). This pattern provides a clean pipeline for validation, transformation, and detailed error mapping.
    *   A legacy pattern using a simpler `parseWithApiError` utility is found in other core features, including "groups" (`src/groups/validation.ts`). This older pattern provides less detailed error messages and leads to scattered, duplicated logic for sanitization and transformation.

*   **Redundant Validation Logic:**
    *   Because the legacy pattern does not have a clean post-validation transformation step, sanitization logic is often handled manually and separately (e.g., in `src/groups/validation.ts`), which is redundant given the capabilities of the `createRequestValidator` pattern.
    *   The `parseWithApiError` utility itself, along with its helper `getDefaultErrorCode`, can be considered redundant if the project were to standardize on the more powerful `createRequestValidator` approach.

---

### 2. Frontend Gaps & Inconsistencies (`webapp-v2/`)

The frontend successfully uses shared schemas for API *response* validation, but fails to leverage them in other key areas.

*   **Major Gap: No Client-Side Form Validation:**
    *   The API request schemas defined in `packages/shared/src/schemas/apiRequests.ts` are **not used for form validation** within the frontend application.
    *   **Impact (Duplication):** This forces the frontend to have its own separate, manually-written validation logic for user input. This duplicates the validation rules already defined in the Zod schemas and creates a high risk of the frontend and backend validation rules drifting out of sync.

*   **Inconsistent & Redundant Schema Definitions:**
    *   The `webapp-v2/src/app/apiClient.ts` file defines its own local Zod schemas (`FirestoreUserSchema`, `ListFirestoreUsersResponseSchema`) instead of using a shared definition from `packages/shared/`.
    *   **Impact:** This is a clear case of schema duplication and indicates a misalignment between the data shape the API provides for that specific endpoint and the shape the frontend expects.

---
