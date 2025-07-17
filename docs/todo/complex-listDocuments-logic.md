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

## Implementation Plan

### Current State Analysis
The `listDocuments` function (lines 188-301) contains three main areas of complex logic:

1. **Document transformation logic** (lines 243-274) - converts Firestore documents to API format
2. **Balance calculation logic** (lines 250-272) - fetches/calculates group balances using existing `balanceCalculator` service
3. **Pagination logic** (lines 210-224, 278-288) - handles cursor encoding/decoding

### Validated Implementation Plan

After analyzing the codebase, this refactoring is valid and worthwhile. The current implementation mixes multiple concerns:
- Document data transformation
- Balance fetching/calculation/caching
- Pagination cursor management

The proposed extraction will improve maintainability and testability.

### Implementation Approach - Small Commits

This task can be broken into independent commits:

#### Commit 1: Extract Pagination Utilities
- Create `src/utils/pagination.ts` with:
  - `decodeCursor(cursor: string): CursorData`
  - `encodeCursor(data: CursorData): string`
  - `buildPaginatedQuery(baseQuery, cursor, order, limit)`
- Add unit tests in `src/utils/pagination.test.ts`
- Update `listDocuments` to use these utilities

#### Commit 2: Extract Document Transformation
- Create `src/documents/transformers.ts` with:
  - `transformDocumentForApi(doc: FirestoreDocument): ApiDocument`
  - Move timestamp validation and conversion logic
- Add unit tests in `src/documents/transformers.test.ts`
- Update `listDocuments` to use transformer

#### Commit 3: Extract Balance Integration Logic
- Add to `src/documents/transformers.ts`:
  - `addGroupBalanceToDocument(document, userId): Promise<Document>`
  - Encapsulate balance fetching, calculation, and caching
- Add tests for balance integration
- Update `listDocuments` to use this function

#### Commit 4: Final Refactor of listDocuments
- Simplify the handler to orchestrate extracted functions
- Ensure all tests pass
- Verify no behavior changes

### Key Considerations

1. **Type Safety**: Ensure all extracted functions have proper TypeScript types
2. **Error Handling**: Maintain existing error handling behavior (e.g., defaulting balance to 0 on error)
3. **Performance**: Keep the parallel processing with `Promise.all`
4. **Testing**: Each extracted function should have focused unit tests

### Risk Assessment

- **Risk**: Low - This is pure refactoring with no behavior changes
- **Complexity**: Moderate - Multiple functions to extract but clear boundaries
- **Testing Strategy**: Run existing integration tests after each commit to ensure no regression

## Implementation Notes
This change will make the code more modular and easier to test. It will also reduce code duplication and make it easier to reason about the application's data transformation logic.