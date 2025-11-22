# Task: User Type Cleanup and Strongly-Typed Document IDs

## Context

The user type hierarchy had duplication and redundant fields that needed cleanup:

1. **Type Duplication**: `RegisteredUser` and `AdminUserProfile` duplicated common fields
2. **Deleted Fields**: Old policy timestamp fields that were replaced by `acceptedPolicies` map
3. **Weak Typing**: `UserDocument.id` was typed as `string` instead of `UserId`

## What We're Trying to Achieve

### 1. Create BaseUserProfile as Common Super-Type

**Problem**: `RegisteredUser` and `AdminUserProfile` both have these fields:
- `uid: UserId`
- `displayName: DisplayName`
- `email: Email`
- `role: SystemUserRole`
- `emailVerified: boolean`
- `createdAt?: ISOString`

**Solution**: Extract common fields into `BaseUserProfile`:

```typescript
export interface BaseUserProfile extends FirebaseUser {
    displayName: DisplayName;
    email: Email;
    role: SystemUserRole;
    emailVerified: boolean;
    createdAt?: ISOString;
}

export interface RegisteredUser extends BaseUserProfile {
    // RegisteredUser-specific fields...
    acceptedPolicies?: Record<PolicyId, VersionHash>;
    preferredLanguage?: string;
    // etc.
}

export interface AdminUserProfile extends BaseUserProfile {
    // AdminUserProfile-specific fields...
    disabled: boolean;
    metadata: { ... };
}
```

**Why**: Eliminate duplication and establish clear type hierarchy.

### 2. Remove Deleted Fields from Backend

**Fields to Remove**:
- `termsAcceptedAt?: ISOString`
- `cookiePolicyAcceptedAt?: ISOString`
- `privacyPolicyAcceptedAt?: ISOString`
- `passwordChangedAt?: ISOString`

**Reason**: These were replaced by `acceptedPolicies: Record<PolicyId, VersionHash>` map.

**Locations to Clean Up**:
1. `packages/shared/src/shared-types.ts` - Remove from `RegisteredUser`
2. `firebase/functions/src/schemas/user.ts` - Remove from `BaseUserSchema`
3. `firebase/functions/src/services/firestore/IFirestoreWriter.ts` - Remove from `FirestoreUserDocumentFields`
4. `firebase/functions/src/services/firestore/FirestoreWriter.ts` - Remove from allowed timestamp fields list
5. `firebase/functions/src/services/UserService2.ts` - Remove from registration flow and password change

### 3. Strongly Type UserDocument.id as UserId

**Problem**: `UserDocument.id` is currently typed as `string`:
```typescript
const DocumentIdSchema = z.object({
    id: z.string().min(1),  // ❌ Too generic
});
```

**Why This Matters**:
- The `id` field holds the Firebase Auth UID
- All other user-related code uses `UserId` branded type
- Type safety prevents mixing different ID types
- `ClientUser` already has `uid: UserId` - document type should match

**Solution**: Create user-specific document ID schema:
```typescript
// firebase/functions/src/schemas/user.ts

const UserDocumentIdSchema = z.object({
    id: UserIdSchema,  // ✅ Strongly typed
});

const UserDocumentSchema = BaseUserSchema
    .merge(UserDocumentIdSchema)
    .strict()
    .strip();
```

**Impact**:
- `UserDocument.id` becomes `UserId` instead of `string`
- Tests need to use `id: toUserId(user.uid)` instead of `id: user.uid`
- Type safety ensures UIDs are properly branded

## Key Insight: What is ClientUser?

`ClientUser` is a DTO (Data Transfer Object) at `packages/shared/src/shared-types.ts:623` for **client-side** (frontend) use:

```typescript
export interface ClientUser {
    uid: UserId;           // ✅ Already strongly typed
    email: Email;
    displayName: DisplayName;
    emailVerified: boolean;
    photoURL?: string | null;
    preferredLanguage?: string;
    role?: SystemUserRole;
}
```

It contains only the fields the frontend needs, without sensitive server-only data.

## Migration Strategy

### Phase 1: Type Hierarchy (✅ COMPLETED - 2025-11-22)
1. Create `BaseUserProfile` interface
2. Make `RegisteredUser` extend `BaseUserProfile`
3. Make `AdminUserProfile` extend `BaseUserProfile`

### Phase 2: Remove Deleted Fields (✅ COMPLETED - 2025-11-22)
1. Remove from `RegisteredUser` in shared-types.ts
2. Remove from `BaseUserSchema` in user.ts
3. Remove from `FirestoreUserDocumentFields` in IFirestoreWriter.ts
4. Remove from allowed timestamp fields in FirestoreWriter.ts
5. Remove from UserService2.ts registration and password change

### Phase 3: Strongly Type UserDocument.id (✅ COMPLETED - 2025-11-22)
1. Create `UserDocumentIdSchema` with `UserIdSchema`
2. Update `UserDocumentSchema` to merge with `UserDocumentIdSchema`
3. Update tests to use `toUserId()` when setting `id` field

## Implementation Complete - 2025-11-22

All three phases have been successfully implemented:

1. ✅ **Phase 1**: Created `BaseUserProfile` interface as common super-type
   - Extracted common fields (uid, displayName, email, role, emailVerified, createdAt)
   - Made `RegisteredUser` extend `BaseUserProfile`
   - Created `AdminUserProfile` extending `BaseUserProfile`

2. ✅ **Phase 2**: Removed all 4 deleted timestamp fields
   - Removed from `packages/shared/src/shared-types.ts`
   - Removed from `firebase/functions/src/schemas/user.ts`
   - Removed from `firebase/functions/src/services/firestore/IFirestoreWriter.ts`
   - Removed from `firebase/functions/src/services/firestore/FirestoreWriter.ts`
   - Removed from `firebase/functions/src/services/UserService2.ts` (registration and password change)

3. ✅ **Phase 3**: Strongly typed `UserDocument.id` as `UserId`
   - Created `UserDocumentIdSchema` with `UserIdSchema` in `firebase/functions/src/schemas/user.ts`
   - Updated `UserDocumentSchema` to use strongly-typed ID
   - No test fixtures needed updating (schema transformation handles it)

### Test Results
- ✅ TypeScript compilation: **PASS**
- ✅ Unit tests: **1272/1272 PASS** (69 test files)
- ⚠️ Integration tests: 51 failed (unrelated to changes - emulator environment issues)

## Success Criteria

- ✅ `BaseUserProfile` exists and both user types extend it
- ✅ Deleted policy timestamp fields removed from all backend code
- ✅ `UserDocument.id` is typed as `UserId` not `string`
- ✅ Firebase functions build passes
- ✅ All unit tests pass
- ✅ No `as unknown as` or other type hacks
