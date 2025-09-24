# User Type Definitions Audit & Refactoring Plan

## 1. Overview

A comprehensive audit of the entire TypeScript codebase was conducted to identify and analyze every type or interface representing an application user. The audit revealed significant redundancy, inconsistency, and misuse of user-related types across the `packages/shared`, `firebase/functions`, and `webapp-v2` packages. This leads to confusion, increases the maintenance burden, and creates potential for bugs due to data mismatches between different layers of the application.

This document outlines the key findings and proposes a phased refactoring plan to unify user types, establishing a single source of truth and improving the overall robustness and clarity of the codebase.

## 2. Key Findings

The audit identified multiple, slightly different definitions for the same core concepts of a "user" and a "group member".

### Finding 1: Redundant Core User Types

The concept of a "user profile" is defined in at least four different places with minor variations:

- **`@splitifyd/shared`**: `RegisteredUser` - The intended canonical type for a user's Firestore document.
- **`firebase/functions/src/services/UserService2.ts`**: `UserProfile` - An internal, slightly different representation used only within this service.
- **`webapp-v2/src/types/auth.ts`**: `User` - The type used by the frontend authentication store, again with minor differences.
- **`firebase/functions/src/auth/middleware.ts`**: An anonymous type on `AuthenticatedRequest['user']` which is another variation.

This duplication forces constant mapping between layers and makes it difficult to maintain a consistent data model.

### Finding 2: Inconsistent Property Naming

- **`uid` vs. `userId`**: The unique identifier for a user is inconsistently named across different interfaces. While the `UserId` branded type provides type safety, the property name itself should be standardized. `uid` is the standard from Firebase Auth.

### Finding 3: Over-exposure of Data in API Responses

- The `getGroupMembersResponseFromSubcollection` method in `UserService2.ts` returns an array of `GroupMemberWithProfile` objects. This type extends the full `RegisteredUser` Firestore model, meaning sensitive or unnecessary data (like `acceptedPolicies`, `termsAcceptedAt`, etc.) is exposed to the client when simply listing group members.

### Finding 4: Lack of a Single Source of Truth

- Although `@splitifyd/shared` is the designated location for shared types, services and frontend stores often define their own local versions, which have drifted over time. `UserService2.ts` and `webapp-v2/src/types/auth.ts` are the primary examples.

## 3. Refactoring & Unification Plan

To address these issues, a phased refactoring approach is recommended.

### Phase 1: Unify the Core `User` Type

The highest priority is to establish a single, canonical representation for a user's profile.

1.  **Establish `RegisteredUser` as the Source of Truth**: The `RegisteredUser` interface in `@splitifyd/shared/src/shared-types.ts` will be the definitive type for a user's full profile data, representing the Firestore document.

2.  **Refactor `UserService2.ts`**:
    - Remove the internal `UserProfile` interface.
    - Update all methods (`getUser`, `getUsers`, `updateProfile`, etc.) to use and return the `RegisteredUser` type from the shared package.

3.  **Refactor `webapp-v2` Auth Store**:
    - Remove the local `User` type definition in `webapp-v2/src/types/auth.ts`.
    - Update the `auth-store` to use the `RegisteredUser` type from the shared package for its user state.

4.  **Standardize Authenticated Request**:
    - Update the `AuthenticatedRequest` interface in `firebase/functions/src/auth/middleware.ts` so that the `user` property is of type `RegisteredUser`.

### Phase 2: Introduce Lean Data Transfer Objects (DTOs)

To prevent over-exposing data, we will create specific DTOs for API responses.

1.  **Create `GroupMemberDTO`**:
    - In `@splitifyd/shared/src/shared-types.ts`, define a new `GroupMemberDTO` interface.
    - This DTO will contain only the fields necessary for displaying a user in a group list: `uid`, `displayName`, `email`, `photoURL`, `initials`, `themeColor`, and `memberRole`.

2.  **Update `UserService2.ts`**:
    - Modify the `getGroupMembersResponseFromSubcollection` method.
    - Instead of returning `GroupMemberWithProfile[]`, it will now fetch the necessary data and map it to the new `GroupMemberDTO[]`, returning only the essential fields to the client.

3.  **Update Frontend Components**:
    - Refactor components in `webapp-v2` that consume the group members list (e.g., `MembersList.tsx`) to use the new `GroupMemberDTO` type.

### Phase 3: Standardize on `uid` and Clean Up

1.  **Standardize `uid`**:
    - Audit all user-related interfaces and ensure the property for the user's unique identifier is consistently named `uid`.
    - Continue to use the `UserId` branded type for this property.

2.  **Refactor Test Data Builders**:
    - Update `UserProfileBuilder` and any other test data builders to use and generate objects conforming to the new unified `RegisteredUser` and `GroupMemberDTO` types. This will ensure that tests are aligned with the new, stricter data models.

## 4. Implementation Status

### ✅ Phase 1: COMPLETED (December 2024)

**Phase 1 has been successfully implemented with the following achievements:**

#### Enhanced Shared Types (`@splitifyd/shared`)
- **Expanded RegisteredUser interface** with all missing fields:
  - Added `emailVerified: boolean` for Firebase Auth verification status
  - Added `photoURL?: string | null` for profile photo URLs
  - Added `createdAt?: Date | FirestoreTimestamp` for document creation timestamp
  - Added `updatedAt?: Date | FirestoreTimestamp` for document modification timestamp
- **Created derived types for specific use cases**:
  - `AuthenticatedUser`: Minimal auth context (`uid`, `email`, `displayName`, `role`)
  - `ClientUser`: Frontend-focused type excluding sensitive server data
- **Comprehensive documentation** added for all user types explaining their purpose and usage

#### Backend Refactoring
- **Removed redundant UserProfile interface** from `UserService2.ts`
- **Updated all service methods** to use and return `RegisteredUser` from shared package
- **Fixed AuthenticatedRequest interface** to use the new `AuthenticatedUser` type
- **Eliminated anti-patterns**:
  - Removed dynamic import pattern in `balance/types.ts`
  - Replaced unsafe `as any` casts with proper type coercion in `SettlementService.ts`
- **Updated all service dependencies** to use the unified types

#### Frontend Unification
- **Replaced local User interface** with `ClientUser` from shared package
- **Updated auth and theme stores** to use shared types consistently
- **Fixed API schema validation** to match backend SystemUserRoles format
- **Resolved frontend/backend schema mismatches** that were causing e2e test failures

#### Test & Validation Fixes
- **Updated all test fixtures** to include newly required fields (`emailVerified`, `photoURL`)
- **Fixed schema validation tests** to match new type requirements
- **Corrected service import paths** in affected test files
- **All e2e tests now pass consistently** after schema validation fixes

#### Technical Debt Reduction
- **Eliminated type casting anti-patterns** throughout the codebase
- **Standardized import patterns** to use proper module imports
- **Fixed circular dependency issues** between services
- **Improved type safety** across all layers of the application

### 🔄 Phase 2: PENDING

Phase 2 (Lean DTOs) is ready for implementation when needed. The current Phase 1 implementation provides a solid foundation for the next phase.

### 🔄 Phase 3: PENDING

Phase 3 (Standardization & Cleanup) awaits Phase 2 completion.

## 5. Expected Benefits

- **Improved Type Safety**: A single source of truth for user types will eliminate a whole class of potential bugs related to data inconsistencies.
- **Reduced Complexity**: Developers will no longer need to map between multiple, slightly different user types.
- **Enhanced Security**: By using lean DTOs, we will no longer expose sensitive or unnecessary user data in API responses.
- **Better Maintainability**: A unified data model is easier to understand, maintain, and extend in the future.

## 6. Lessons Learned from Phase 1

- **Frontend/Backend Schema Alignment**: Critical to ensure Zod schemas match backend enum formats exactly
- **Test Coverage**: Comprehensive test updates were essential to catch breaking changes early
- **Incremental Validation**: Running tests frequently during refactoring prevented cascading issues
- **Type Safety Benefits**: The unified types immediately caught several latent bugs in the codebase
