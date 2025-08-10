
# Refactor Magic Strings to Shared Constants

## Problem

There are numerous "magic strings" (hardcoded string literals) duplicated across the client and server codebases. This practice is problematic because:

-   **It's error-prone:** A typo in one location can lead to subtle bugs that are hard to track down.
-   **It makes changes difficult:** Updating a value requires finding and replacing all instances, which is time-consuming and risky.
-   **It obscures intent:** Shared constants provide a single source of truth and make the code more self-documenting.

## Solution

The plan is to centralize these magic strings into the `firebase/functions/src/types/webapp-shared-types.ts` file. This file is already shared between the client and server, making it the ideal location for these constants.

### Identified Magic Strings and Cleanup Plan

1.  **User Roles (`"user"`, `"admin"`)**
    *   **Locations:**
        *   `firebase/functions/src/auth/handlers.ts`
        *   `firebase/functions/src/auth/middleware.ts`
        *   `webapp-v2/src/api/apiSchemas.ts`
    *   **Plan:** Create a `UserRole` enum or a const object in `webapp-shared-types.ts`.

2.  **Firestore Collection Names (`"documents"`, `"expenses"`, `"settlements"`, `"users"`, `"policies"`)**
    *   **Locations:**
        *   `firebase/functions/src/expenses/handlers.ts`
        *   `firebase/functions/src/groups/balanceHandlers.ts`
        *   `firebase/functions/src/groups/handlers.ts`
        *   `firebase/functions/src/groups/memberHandlers.ts`
        *   `firebase/functions/src/groups/shareHandlers.ts`
        *   `firebase/functions/src/services/balanceCalculator.ts`
        *   `firebase/functions/src/services/expenseMetadataService.ts`
        *   `firebase/functions/src/settlements/handlers.ts`
        *   `firebase/functions/src/auth/handlers.ts`
        *   `firebase/functions/src/auth/middleware.ts`
        *   `firebase/functions/src/auth/policy-helpers.ts`
        *   `firebase/functions/src/policies/handlers.ts`
        *   `firebase/functions/src/scripts/seed-policies.ts`
    *   **Plan:** Create a `FirestoreCollection` enum or a const object in `webapp-shared-types.ts`.

3.  **Expense Split Types (`"equal"`, `"exact"`, `"percentage"`)**
    *   **Locations:**
        *   `firebase/functions/src/expenses/handlers.ts`
        *   `firebase/functions/src/expenses/validation.ts`
        *   `webapp-v2/src/api/apiSchemas.ts`
        *   `webapp-v2/src/app/stores/expense-form-store.ts`
    *   **Plan:** This is already defined as a type, but we should create a `SplitType` const object to reference the string values.

4.  **Auth Error Codes (`"auth/email-already-exists"`, `"EMAIL_EXISTS"`)**
    *   **Locations:**
        *   `firebase/functions/src/auth/handlers.ts`
        *   `webapp-v2/src/app/stores/auth-store.ts`
    *   **Plan:** Create an `AuthError` const object in `webapp-shared-types.ts`.

5.  **Policy IDs (`"terms-of-service"`, `"cookie-policy"`, `"privacy-policy"`)**
    *   **Locations:**
        *   `firebase/functions/src/scripts/seed-policies.ts`
        *   `webapp-v2/src/pages/static/CookiePolicyPage.tsx`
        *   `webapp-v2/src/pages/static/PrivacyPolicyPage.tsx`
        *   `webapp-v2/src/pages/static/TermsOfServicePage.tsx`
    *   **Plan:** Create a `PolicyId` enum or a const object in `webapp-shared-types.ts`.

6.  **`"deletedAt"` Field Name**
    *   **Locations:**
        *   `firebase/functions/src/expenses/handlers.ts`
        *   `firebase/functions/src/expenses/validation.ts`
        *   `webapp-v2/src/components/group/ExpenseItem.tsx`
    *   **Plan:** Add a `DELETED_AT_FIELD` constant to `webapp-shared-types.ts`.

## Current Status

✅ **Constants Added to `webapp-shared-types.ts`:** All identified magic strings have been centralized as const objects:
- `UserRoles` (lines 9-12)
- `FirestoreCollections` (lines 14-20)  
- `SplitTypes` (lines 22-26)
- `AuthErrors` (lines 28-31)
- `PolicyIds` (lines 33-37)
- `DELETED_AT_FIELD` (line 39)

## Implementation Plan

### Phase 1: Server-Side Refactoring (`firebase/functions/src/`)

**Priority: High** - These changes will prevent bugs and improve maintainability

1. **Auth & Middleware Files**
   - [ ] `auth/handlers.ts` - Replace user roles and collection names
   - [ ] `auth/middleware.ts` - Replace user roles and collection names
   - [ ] `auth/policy-helpers.ts` - Replace collection names

2. **Core Business Logic**
   - [ ] `expenses/handlers.ts` - Replace collection names, split types, `deletedAt`
   - [ ] `expenses/validation.ts` - Replace split types, `deletedAt`
   - [ ] `settlements/handlers.ts` - Replace collection names
   - [ ] `policies/handlers.ts` - Replace collection names and policy IDs

3. **Group Management**
   - [ ] `groups/handlers.ts` - Replace collection names
   - [ ] `groups/balanceHandlers.ts` - Replace collection names
   - [ ] `groups/memberHandlers.ts` - Replace collection names
   - [ ] `groups/shareHandlers.ts` - Replace collection names

4. **Services**
   - [ ] `services/balanceCalculator.ts` - Replace collection names
   - [ ] `services/expenseMetadataService.ts` - Replace collection names

5. **Scripts**
   - [ ] `scripts/seed-policies.ts` - Replace policy IDs and collection names

### Phase 2: Client-Side Refactoring (`webapp-v2/src/`)

**Priority: Medium** - These changes will ensure consistency between client and server

1. **API Layer**
   - [ ] `api/apiSchemas.ts` - Replace user roles and split types

2. **Store Layer**
   - [ ] `app/stores/auth-store.ts` - Replace auth error codes
   - [ ] `app/stores/expense-form-store.ts` - Replace split types

3. **Policy Pages**
   - [ ] `pages/static/CookiePolicyPage.tsx` - Replace policy IDs
   - [ ] `pages/static/PrivacyPolicyPage.tsx` - Replace policy IDs
   - [ ] `pages/static/TermsOfServicePage.tsx` - Replace policy IDs

4. **Components**
   - [ ] `components/group/ExpenseItem.tsx` - Replace `DELETED_AT_FIELD`

### Phase 3: Testing & Validation

1. **Automated Testing**
   - [ ] Run unit tests: `npm test`
   - [ ] Run integration tests in Firebase functions
   - [ ] Run E2E tests to ensure UI still works

2. **Manual Verification**
   - [ ] Test user registration and login
   - [ ] Test expense creation with different split types
   - [ ] Test policy page loading
   - [ ] Test expense deletion (soft delete functionality)

### Phase 4: Implementation Guidelines

**Search and Replace Strategy:**
```bash
# Example for FirestoreCollections.EXPENSES
# Before: 'expenses' or "expenses"
# After: FirestoreCollections.EXPENSES

# Server files - add import:
import { FirestoreCollections } from '../types/webapp-shared-types';

# Client files - add import:
import { FirestoreCollections } from '@shared/types/webapp-shared-types';
```

**Import Guidelines:**
- Server files: `import { ConstantName } from '../types/webapp-shared-types';`
- Client files: `import { ConstantName } from '@shared/types/webapp-shared-types';`

**Priority Order:**
1. Start with server-side auth and core business logic (highest risk for bugs)
2. Move to collections and data access patterns
3. Finish with client-side UI components
4. Validate with comprehensive testing

**Risk Mitigation:**
- Make changes in small, testable chunks
- Run tests after each file modification
- Use TypeScript's compiler to catch import/reference errors
- Test auth flows and expense operations thoroughly

## Benefits After Implementation

1. **Type Safety**: All magic strings become typed constants
2. **Refactoring Safety**: Changing a value requires updating only one location
3. **IDE Support**: Auto-completion and find-all-references work properly
4. **Self-Documenting**: Constants provide clear intent and prevent typos
5. **Consistency**: Shared constants ensure client-server alignment

This refactoring will significantly improve the codebase's quality and maintainability.
