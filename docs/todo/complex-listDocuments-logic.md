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

### Detailed Implementation Steps

#### Step 1: Extract Document Transformation Logic
- Create `transformDocumentForApi` function that handles:
  - Timestamp conversion to ISO strings
  - Basic document structure mapping
  - Validation of Firestore Timestamp fields
- Location: New file `src/documents/transformers.ts`

#### Step 2: Extract Balance Integration Logic  
- Create `addGroupBalanceToDocument` function that handles:
  - Checking if document is a group document
  - Fetching cached balance from group-balances collection
  - Falling back to `calculateGroupBalances` if no cache exists
  - Caching calculated results
- Location: `src/documents/transformers.ts` (works with existing `balanceCalculator.ts`)

#### Step 3: Extract Pagination Logic
- Create `decodeCursor` and `encodeCursor` functions
- Create `buildPaginatedQuery` function
- Location: New file `src/utils/pagination.ts`

#### Step 4: Refactor listDocuments
- Simplify main function to orchestrate the extracted functions
- Maintain same API contract
- Improve readability and maintainability

#### Step 5: Add Tests
- Unit tests for transformer functions
- Unit tests for pagination utilities
- Integration tests for listDocuments behavior

### Files to Create/Modify
- **New**: `src/documents/transformers.ts` - document transformation logic
- **New**: `src/utils/pagination.ts` - pagination utilities  
- **Modify**: `src/documents/handlers.ts` - simplified listDocuments function
- **New**: `src/documents/transformers.test.ts` - unit tests
- **New**: `src/utils/pagination.test.ts` - unit tests

### Approach
This refactoring will:
- Extract reusable functions without changing external API
- Maintain compatibility with existing `balanceCalculator` service
- Make code more testable and maintainable
- Follow single responsibility principle
- Enable easier future enhancements

## Implementation Notes
This change will make the code more modular and easier to test. It will also reduce code duplication and make it easier to reason about the application's data transformation logic.