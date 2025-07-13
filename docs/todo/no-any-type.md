# Use of `any` Type

## Problem
- **Location**: Throughout the codebase, particularly in `firebase/functions/src/documents/handlers.ts`, `webapp/src/js/api.ts`, and `webapp/src/js/utils/forms.ts`.
- **Description**: The `any` type is used in several places, which undermines the benefits of TypeScript. Using `any` bypasses type checking, making the code more prone to runtime errors and harder to refactor and maintain.
- **Current vs Expected**: Currently, `any` is used as a quick way to bypass type checking. It should be replaced with more specific types or interfaces to provide better type safety.

## Solution
- **Approach**: Replace all instances of `any` with more specific types. This may involve creating new interfaces or types to describe the shape of the data. For example, in `firebase/functions/src/documents/handlers.ts`, the `document.data` property should have a well-defined interface.
- **Code Sample**:
  ```typescript
  // Instead of:
  // const document = doc.data() as any;

  // Use a specific interface:
  interface GroupData {
    name: string;
    members: { uid: string; name: string; role: string }[];
    // ... other properties
  }

  interface Document {
    userId: string;
    data: GroupData;
    // ... other properties
  }

  const document = doc.data() as Document;
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate (requires changes in multiple files)
- **Benefit**: High value (improves type safety, code quality, and maintainability)

## Implementation Notes
This change will require a thorough review of the codebase to identify all instances of `any`. It's a good opportunity to improve the overall type coverage of the project.