# Firebase Auth Service Interface Abstraction Plan

## Overview

This document outlines the plan to create an `IAuthService` interface that abstracts Firebase Auth operations, following the same architectural patterns established by `IFirestoreReader` and `IFirestoreWriter`. This abstraction will improve testability, maintainability, and provide a consistent approach to dependency injection across the application.

## Current State Analysis

### Existing Firestore Interface Patterns

The codebase already has excellent patterns established:

1. **IFirestoreReader**: Centralized interface for all read operations with type-safe, validated access
2. **IFirestoreWriter**: Centralized interface for all write operations with validation and error handling
3. **ApplicationBuilder**: Dependency injection container that builds service instances
4. **FirestoreValidationService**: Centralized validation using Zod schemas

### Current Firebase Auth Usage

Firebase Auth is currently used directly across multiple files:

- **firebase.ts**: Exports `getAuth()` function for lazy initialization
- **auth/middleware.ts**: Token verification, user lookup, role checking
- **services/UserService2.ts**: User creation, updates, password changes, account deletion
- **test-pool/TestUserPoolService.ts**: Custom token creation for test users

### Problems with Current Approach

1. **Direct dependency on Firebase Auth**: Makes testing difficult, requires emulator for unit tests
2. **Scattered auth operations**: Auth logic spread across multiple files
3. **Inconsistent error handling**: Different error patterns compared to Firestore services
4. **No centralized validation**: Auth operations don't follow the established validation patterns
5. **Difficult to mock**: Direct `getAuth()` calls can't be easily mocked for unit testing

## Proposed Solution

### 1. IAuthService Interface Design

Create a comprehensive interface that mirrors the Firestore patterns:

```typescript
export interface IAuthService {
    // ========================================================================
    // User Management Operations
    // ========================================================================

    /**
     * Create a new user in Firebase Auth
     * @param userData - User creation data (email, password, displayName, etc.)
     * @returns UserRecord with generated UID
     */
    createUser(userData: CreateUserRequest): Promise<UserRecord>;

    /**
     * Get a user by UID
     * @param uid - Firebase user UID
     * @returns UserRecord or null if not found
     */
    getUser(uid: string): Promise<UserRecord | null>;

    /**
     * Get multiple users by UIDs (batch operation)
     * @param uids - Array of Firebase user UIDs
     * @returns GetUsersResult with found/not found users
     */
    getUsers(uids: string[]): Promise<GetUsersResult>;

    /**
     * Update user profile in Firebase Auth
     * @param uid - Firebase user UID
     * @param updates - Profile updates (displayName, photoURL, etc.)
     * @returns Updated UserRecord
     */
    updateUser(uid: string, updates: UpdateRequest): Promise<UserRecord>;

    /**
     * Delete a user from Firebase Auth
     * @param uid - Firebase user UID
     * @returns Success confirmation
     */
    deleteUser(uid: string): Promise<void>;

    // ========================================================================
    // Token Operations
    // ========================================================================

    /**
     * Verify an ID token and return decoded claims
     * @param idToken - Firebase ID token from client
     * @returns Decoded token with user claims
     */
    verifyIdToken(idToken: string): Promise<DecodedIdToken>;

    /**
     * Create a custom token for a user (for testing/admin use)
     * @param uid - Firebase user UID
     * @param additionalClaims - Optional custom claims
     * @returns Custom token string
     */
    createCustomToken(uid: string, additionalClaims?: object): Promise<string>;

    // ========================================================================
    // User Lookup Operations
    // ========================================================================

    /**
     * Get user by email address
     * @param email - User email address
     * @returns UserRecord or null if not found
     */
    getUserByEmail(email: string): Promise<UserRecord | null>;

    /**
     * Get user by phone number
     * @param phoneNumber - User phone number
     * @returns UserRecord or null if not found
     */
    getUserByPhoneNumber(phoneNumber: string): Promise<UserRecord | null>;

    // ========================================================================
    // Bulk Operations
    // ========================================================================

    /**
     * Create multiple users in batch
     * @param users - Array of user creation requests
     * @returns Array of creation results
     */
    createUsers(users: CreateUserRequest[]): Promise<CreateUsersResult>;

    /**
     * Delete multiple users in batch
     * @param uids - Array of user UIDs to delete
     * @returns Array of deletion results
     */
    deleteUsers(uids: string[]): Promise<DeleteUsersResult>;
}
```

### 2. Implementation Strategy

#### Phase 1: Core Interface and Implementation

1. **Create IAuthService interface** (`src/services/auth/IAuthService.ts`)
2. **Create FirebaseAuthService implementation** (`src/services/auth/FirebaseAuthService.ts`)
3. **Add AuthService to ApplicationBuilder**
4. **Create validation schemas for auth operations**

#### Phase 2: Migrate Existing Code

1. **Update auth/middleware.ts** to use IAuthService
2. **Update UserService2.ts** to use IAuthService instead of direct getAuth()
3. **Update TestUserPoolService.ts** to use IAuthService
4. **Remove direct getAuth() imports where replaced**

#### Phase 3: Testing and Validation

1. **Create MockAuthService for unit testing**
2. **Add comprehensive unit tests**
3. **Update integration tests to use new interface**
4. **Performance testing and optimization**

### 3. Detailed Implementation Plan

#### 3.1 File Structure

```
src/services/auth/
├── IAuthService.ts                 # Main interface definition
├── FirebaseAuthService.ts          # Firebase implementation
├── MockAuthService.ts              # Mock implementation for testing
├── auth-types.ts                   # Type definitions and interfaces
├── auth-validation.ts              # Joi validation schemas
└── auth-errors.ts                  # Auth-specific error definitions
```

#### 3.2 Integration with ApplicationBuilder

```typescript
// In ApplicationBuilder.ts
export class ApplicationBuilder {
    private authService?: IAuthService;

    buildAuthService(): IAuthService {
        if (!this.authService) {
            this.authService = new FirebaseAuthService(
                this.buildValidationService(),
                // other dependencies
            );
        }
        return this.authService;
    }
}
```

#### 3.3 Error Handling Strategy

Follow the same patterns as Firestore services:

1. **Consistent error types**: Use ApiError class with standardized error codes
2. **Centralized error mapping**: Map Firebase Auth errors to application errors
3. **Validation integration**: Use Joi schemas for request validation
4. **Logging integration**: Use existing logger with context

#### 3.4 Validation Integration

```typescript
// auth-validation.ts
export const CreateUserRequestSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(PASSWORD_REGEX).required(),
    displayName: displayNameSchema,
    phoneNumber: Joi.string().optional(),
    photoURL: Joi.string().uri().optional(),
});

export const UpdateUserRequestSchema = Joi.object({
    displayName: displayNameSchema.optional(),
    photoURL: Joi.string().uri().allow(null).optional(),
    phoneNumber: Joi.string().allow(null).optional(),
    disabled: Joi.boolean().optional(),
});
```

### 4. Benefits

#### 4.1 Improved Testability
- Unit tests can use MockAuthService without Firebase emulator
- Faster test execution
- More reliable CI/CD pipeline

#### 4.2 Better Abstraction
- Hide Firebase-specific implementation details
- Easier to switch auth providers if needed
- Consistent interface across the application

#### 4.3 Enhanced Error Handling
- Standardized error responses
- Better error context and logging
- Consistent validation patterns

#### 4.4 Maintainability
- Centralized auth operations
- Single point of change for auth logic
- Follows established architectural patterns

### 5. Migration Strategy

#### 5.1 Backward Compatibility
- Keep existing `getAuth()` function during transition
- Gradual migration of services one by one
- No breaking changes to external APIs

#### 5.2 Testing Strategy
- Create comprehensive unit tests for new interface
- Integration tests with Firebase emulator
- Performance benchmarks to ensure no regression

#### 5.3 Rollout Plan
1. **Week 1**: Create interface and basic implementation
2. **Week 2**: Migrate auth middleware and add tests
3. **Week 3**: Migrate UserService2 and TestUserPoolService
4. **Week 4**: Remove deprecated code and optimize

### 6. Risk Assessment

#### 6.1 Low Risk
- No changes to external APIs
- Follows established patterns
- Gradual migration approach

#### 6.2 Mitigation Strategies
- Comprehensive testing before migration
- Feature flags for gradual rollout
- Rollback plan with git history

### 7. Success Metrics

#### 7.1 Technical Metrics
- **Unit test coverage**: >95% for auth operations
- **Performance**: No degradation in auth operations
- **Error rate**: Reduced auth-related errors

#### 7.2 Developer Experience
- **Reduced test setup complexity**: No emulator needed for unit tests
- **Improved debugging**: Better error messages and context
- **Consistent patterns**: Auth follows same patterns as Firestore

### 8. Implementation Checklist

#### Phase 1: Foundation
- [ ] Create IAuthService interface with comprehensive method signatures
- [ ] Implement FirebaseAuthService with error handling and validation
- [ ] Create auth-specific validation schemas using Joi
- [ ] Add AuthService to ApplicationBuilder with proper dependency injection
- [ ] Create MockAuthService for testing

#### Phase 2: Migration
- [ ] Update auth/middleware.ts to use IAuthService
- [ ] Migrate UserService2.ts auth operations
- [ ] Update TestUserPoolService.ts
- [ ] Update any other files using direct getAuth()

#### Phase 3: Testing & Optimization
- [ ] Add comprehensive unit tests using MockAuthService
- [ ] Update integration tests
- [ ] Performance testing and benchmarking
- [ ] Documentation updates

#### Phase 4: Cleanup
- [ ] Remove deprecated getAuth() usage
- [ ] Clean up imports and dependencies
- [ ] Update code documentation
- [ ] Team knowledge transfer

### 9. Example Usage After Implementation

```typescript
// Before (direct Firebase dependency)
import { getAuth } from '../firebase';
const userRecord = await getAuth().getUser(uid);

// After (using interface)
class SomeService {
    constructor(private authService: IAuthService) {}

    async getSomeUser(uid: string) {
        const userRecord = await this.authService.getUser(uid);
        // Clean, testable, consistent with other services
    }
}

// In tests
const mockAuth = new MockAuthService();
mockAuth.setUser(testUid, mockUserRecord);
const service = new SomeService(mockAuth);
// No Firebase emulator needed!
```

## Complete Refactoring Requirements

Based on comprehensive analysis, here are ALL the files that need to be refactored to use the new IAuthService interface:

### Production Code Files (21 occurrences across 7 files)

1. **firebase/functions/src/firebase.ts**
   - Line 109: Export of `getAuth()` function - Keep during transition, deprecate later

2. **firebase/functions/src/auth/middleware.ts** (2 occurrences)
   - Line 49: `await getAuth().verifyIdToken(token)` - Token verification
   - Line 52: `await getAuth().getUser(decodedToken.uid)` - User lookup

3. **firebase/functions/src/services/UserService2.ts** (11 occurrences)
   - Line 119: `getAuth().getUser(userId)` - Get single user
   - Line 172: `getAuth().getUsers(uids.map(...))` - Batch get users
   - Line 221: `getAuth().updateUser(userId, authUpdateData)` - Update user profile
   - Line 285: `getAuth().getUser(userId)` - Get user for password change
   - Line 296: `getAuth().updateUser(userId, {...})` - Update password
   - Line 359: `getAuth().deleteUser(userId)` - Delete user account
   - Line 475: `getAuth().createUser(c)` - Create new user
   - Line 537: `getAuth().deleteUser(userRecord.uid)` - Cleanup on failure
   - Plus imports of `UpdateRequest`, `UserRecord`, `CreateRequest` types

4. **firebase/functions/src/services/CommentService.ts** (1 occurrence)
   - Line 151: `getAuth().getUser(userId)` - Get user for comment author

5. **firebase/functions/src/test-pool/TestUserPoolService.ts** (1 occurrence)
   - Line 117: `getAuth().createCustomToken(user.uid)` - Create test token

6. **firebase/functions/src/test/policy-handlers.ts** (1 occurrence)
   - Line 89: `const auth = getAuth()` - Admin endpoint for listing users

7. **firebase/functions/src/index.ts** (1 occurrence)
   - Line 101: `getAuth().listUsers(SYSTEM.AUTH_LIST_LIMIT)` - Health check

### Test Files That Need Updates

1. **firebase/functions/src/__tests__/integration/normal-flow/UserService.integration.test.ts** (6 occurrences)
   - Lines 44, 123, 242, 273, 400, 472: Various `getAuth()` calls for verification

2. **firebase/functions/src/__tests__/unit/services/CommentService.test.ts**
   - Currently mocks `getAuth()` via `vi.mock('../../../firebase')`
   - Needs to use MockAuthService instead

3. **Other unit tests that may need updates:**
   - Any test that currently mocks Firebase auth will need to use MockAuthService
   - Tests for UserService2, auth middleware, TestUserPoolService

## Detailed Migration Plan per File

### Phase 1: Create Core Infrastructure
1. Create `IAuthService` interface
2. Create `FirebaseAuthService` implementation
3. Create `MockAuthService` for testing
4. Add to `ApplicationBuilder`

### Phase 2: Migrate Core Services

#### 2.1 auth/middleware.ts
```typescript
// Add dependency injection
constructor(private authService: IAuthService) {}

// Replace:
const decodedToken = await getAuth().verifyIdToken(token);
const userRecord = await getAuth().getUser(decodedToken.uid);

// With:
const decodedToken = await this.authService.verifyIdToken(token);
const userRecord = await this.authService.getUser(decodedToken.uid);
```

#### 2.2 UserService2.ts
```typescript
// Add to constructor
constructor(
    private readonly authService: IAuthService,
    // ... other dependencies
) {}

// Replace all getAuth() calls with this.authService
// Example:
// Before: await getAuth().getUser(userId)
// After: await this.authService.getUser(userId)
```

#### 2.3 CommentService.ts
```typescript
// Add IAuthService to constructor
// Replace getAuth().getUser() with this.authService.getUser()
```

#### 2.4 TestUserPoolService.ts
```typescript
// Add IAuthService to constructor
// Replace getAuth().createCustomToken() with this.authService.createCustomToken()
```

### Phase 3: Update Test Files

#### 3.1 Unit Tests
- Replace all `vi.mock('../../../firebase')` with MockAuthService injection
- Update test setup to create MockAuthService instances
- Configure mock responses as needed

#### 3.2 Integration Tests
- Can continue using real Firebase Auth via FirebaseAuthService
- Or use MockAuthService for faster execution

### Phase 4: Update ApplicationBuilder Usage

All files that instantiate services need to pass IAuthService:

```typescript
const authService = applicationBuilder.buildAuthService();
const userService = new UserService(
    firestoreReader,
    firestoreWriter,
    validationService,
    notificationService,
    authService // New dependency
);
```

## Summary of Changes

- **7 production files** with 21 direct `getAuth()` calls
- **Multiple test files** that mock Firebase Auth
- **All service constructors** that use auth need IAuthService injection
- **ApplicationBuilder** needs to wire up dependencies

## Benefits of This Refactoring

1. **Testability**: No Firebase emulator needed for unit tests
2. **Consistency**: Follows established IFirestoreReader/Writer patterns
3. **Maintainability**: Centralized auth logic
4. **Flexibility**: Easy to swap auth providers
5. **Type Safety**: Interface enforces consistent usage

## Implementation Order

1. Create interface and implementations (no breaking changes)
2. Update ApplicationBuilder
3. Migrate services one by one (UserService2 first as it has most usage)
4. Update tests to use MockAuthService
5. Deprecate and remove direct getAuth() usage

This comprehensive refactoring will bring Firebase Auth in line with the excellent patterns already established for Firestore operations. The phased approach ensures minimal risk while providing maximum benefit to the development team.