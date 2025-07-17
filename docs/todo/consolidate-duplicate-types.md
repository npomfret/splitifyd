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

## Analysis Complete - Duplicates Confirmed

### 1. `User` interface - DUPLICATE CONFIRMED
- **Location 1**: `/webapp/src/js/store.ts` (lines 3-7) - Simple version with `id`, `email`, `displayName?`
- **Location 2**: `/webapp/src/js/types/global.d.ts` (lines 53-61) - Extended version with `uid`, `groups?`, `createdAt?`, `updatedAt?`
- **Action**: Keep the global.d.ts version (more comprehensive), remove from store.ts

### 2. `Group` interface - DUPLICATE CONFIRMED  
- **Location 1**: `/webapp/src/js/types/global.d.ts` (lines 63-71) - Has `members: string[]`
- **Location 2**: `/webapp/src/js/types/business-logic.d.ts` (lines 11-20) - Has `members: string[]` and `memberCount: number`
- **Action**: Keep business-logic.d.ts version (more comprehensive), remove from global.d.ts

### 3. `FormFieldConfig` interface - DUPLICATE CONFIRMED
- **Location 1**: `/webapp/src/js/types/components.d.ts` (lines 64-79) - More comprehensive with many field types
- **Location 2**: `/webapp/src/js/types/business-logic.d.ts` (lines 47-58) - Different field structure
- **Action**: Keep components.d.ts version (more comprehensive), remove from business-logic.d.ts

### 4. `PaginationConfig` interface - DUPLICATE CONFIRMED
- **Location 1**: `/webapp/src/js/types/components.d.ts` (lines 114-118) - Has `onPageChange: (page: number) => void`
- **Location 2**: `/webapp/src/js/types/business-logic.d.ts` (lines 76-80) - Has `onPageChange?: (page: number) => void` (optional)
- **Action**: Keep components.d.ts version (required callback is better), remove from business-logic.d.ts

## Implementation Plan

### Step 1: Remove User interface from store.ts
- Delete the User interface definition from store.ts (lines 3-7)
- Add import: `import { User } from './types/global.js';`

### Step 2: Remove Group interface from global.d.ts
- Delete the Group interface definition from global.d.ts (lines 63-71)
- Update the export statement to remove Group

### Step 3: Remove FormFieldConfig from business-logic.d.ts
- Delete the FormFieldConfig interface definition from business-logic.d.ts (lines 47-58)

### Step 4: Remove PaginationConfig from business-logic.d.ts
- Delete the PaginationConfig interface definition from business-logic.d.ts (lines 76-80)

### Step 5: Update imports in business-logic.d.ts
- Add import for FormFieldConfig and PaginationConfig from components.d.ts
- Add re-export for these types

### Step 6: Verify no broken imports
- Run build to ensure no TypeScript errors
- Check that all files importing these types still work correctly

## Benefits
- Single source of truth for each type
- Reduced maintenance burden
- Better type consistency
- Cleaner codebase