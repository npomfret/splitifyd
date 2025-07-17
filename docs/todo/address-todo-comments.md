# Address TODO Comments

## Issue
TODO comments exist in the codebase that should be addressed or removed.

## TODO Comments Found

### 1. Type Mismatch TODO
**Location:** `/webapp/src/js/groups.ts` (line 229)
**Comment:** "TODO: Fix lastExpense type mismatch"
**Context:** Related to expense type handling in group transformations

### 2. API Availability TODO  
**Location:** `/webapp/src/js/group-detail.ts` (line 701)
**Comment:** "TODO: Uncomment when API is available"
**Context:** Commented out code waiting for API implementation

## Action Required
1. Fix the type mismatch issue in groups.ts
2. Either implement the API or remove the commented code in group-detail.ts
3. Remove TODO comments once addressed
4. Add a linting rule to prevent TODO comments in production code