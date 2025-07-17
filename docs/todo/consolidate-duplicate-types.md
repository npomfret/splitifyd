# Consolidate Duplicate Type Definitions

## Issue
Multiple type definitions exist across different files causing duplication and potential inconsistencies.

## Duplicate Types Found

### 1. `User` interface
- `/webapp/src/js/store.ts`
- `/webapp/src/js/types/global.d.ts`

### 2. `Group` interface  
- `/webapp/src/js/types/global.d.ts`
- `/webapp/src/js/types/business-logic.d.ts`

### 3. `FormFieldConfig` interface
- `/webapp/src/js/types/components.d.ts`
- `/webapp/src/js/types/business-logic.d.ts`

### 4. `PaginationConfig` interface
- `/webapp/src/js/types/components.d.ts`
- `/webapp/src/js/types/business-logic.d.ts`

## Action Required
1. Choose a single location for each type definition
2. Remove duplicates
3. Update imports to reference the single source of truth
4. Consider following the existing pattern of defining types in firebase/functions and symlinking to webapp