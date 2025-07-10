# Webapp Issue: Client-Server Data Integrity

## Issue Description

Client-side JavaScript code is fragile and frequently breaks due to unexpected changes in the shape of JSON objects returned from the server. This is caused by the absence of a data contract between the frontend and the backend, leading to assumptions about data structure being violated.

## Recommendation

Adopt **Option 1: Shared TypeScript Types** as a starting point. This involves defining API response data structures (interfaces or types) in a shared location accessible to both the `firebase` (backend) and `webapp` (frontend) projects. This creates a single source of truth and allows the frontend to leverage these types for early error detection and improved developer experience.

## Implementation Suggestions

1.  **Create a shared directory:** Create a new directory, for example, `packages/shared-types`, that is accessible to both the `firebase` and `webapp` projects.

2.  **Define Data Transfer Objects (DTOs):** In this shared directory, define TypeScript interfaces for all API payloads. For example, a `Group` type would look the same for the client and the server.

3.  **Backend Refactoring:** Update backend functions to import and use these shared types in their function signatures and return types.

4.  **Frontend Adoption:** The frontend, while still being JavaScript, can leverage these types using JSDoc annotations. With a `jsconfig.json` file in the `webapp` directory, modern code editors like VS Code can provide type-checking and IntelliSense, alerting developers when they are accessing properties that don't exist.

### Next Steps (from original report):

1.  Create a `packages/shared-types` directory.
2.  Define a TypeScript interface for a single, core data model (e.g., `Group` or `Expense`) as a proof-of-concept.
3.  Refactor the relevant Firebase Function to use this shared type.
4.  Set up a `jsconfig.json` in the `webapp` project and update a piece of client-side code to use the shared type via JSDoc comments.
5.  Verify that type-checking and autocompletion are working in the IDE for the client-side code.

### Future Consideration:

Once shared types are in place, consider **Option 3: Combining Shared Types and Runtime Validation**. This involves using shared TypeScript types to automatically generate Zod schemas for runtime validation, providing both development-time benefits and runtime safety.
