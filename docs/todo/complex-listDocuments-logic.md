# Complex and Duplicated Logic in `listDocuments`

## Problem
- **Location**: `firebase/functions/src/documents/handlers.ts`
- **Description**: The `listDocuments` handler contains complex logic for fetching and transforming documents, including fetching and calculating group balances. This logic is difficult to read and maintain, and some parts of it are duplicated in other handlers.
- **Current vs Expected**: Currently, the handler is doing too much. The logic for fetching and transforming documents should be extracted into separate, reusable functions.

## Solution
- **Approach**: 
  1. **Extract Document Transformation**: Create a `transformDocument` function that takes a Firestore document and transforms it into the desired format for the API response.
  2. **Extract Balance Calculation**: The logic for fetching and calculating group balances should be moved to a separate `group-service.ts` file and exposed as a function, e.g., `getGroupBalance`.
  3. **Simplify `listDocuments`**: Refactor the `listDocuments` handler to use these new functions. This will make the handler much simpler and easier to understand.

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate
- **Benefit**: Medium impact (improves code quality, readability, and maintainability)

## Implementation Notes
This change will make the code more modular and easier to test. It will also reduce code duplication and make it easier to reason about the application's data transformation logic.