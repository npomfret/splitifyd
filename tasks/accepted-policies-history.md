# Task: Store a History of Accepted Policies

**Author:** Gemini
**Date:** 2025-11-24
**Status:** ✅ Completed
**Reviewed:** 2025-11-25 (sanity check completed)
**Implemented:** 2025-11-27

## 1. Executive Summary

The current data model for tracking user policy acceptances only stores the most recently accepted version hash for each policy. This is insufficient for auditing purposes and for features that may depend on knowing the full history of a user's consent. This document proposes a change to the `acceptedPolicies` data structure within the user object to store a complete history of all policy versions accepted by a user, including the date of acceptance for each.

## 2. Background

Currently, the `user.acceptedPolicies` object is stored in Firestore as `Record<PolicyId, VersionHash>`.

```json
{
  "acceptedPolicies": {
    "privacy-policy": "v2_hash_abc",
    "terms-of-service": "v1_hash_xyz"
  }
}
```

When a user accepts a new version of a policy (e.g., "privacy-policy" v3), the existing hash is overwritten. This means we lose the record that the user ever accepted v2. For compliance and historical tracking, it is critical to know every version of a policy a user has agreed to and when they did so.

## 3. Proposed Change

We propose changing the structure of `acceptedPolicies` to be a map where each `PolicyId` keys to another map. This inner map will use the `VersionHash` as its key and the acceptance timestamp as its value.

The new proposed structure will be `Record<PolicyId, Record<VersionHash, Timestamp>>`.

### New Data Structure Example

```json
{
  "acceptedPolicies": {
    "privacy-policy": {
      "v1_hash_123": "2024-08-15T10:00:00Z",
      "v2_hash_abc": "2025-03-20T14:30:00Z"
    },
    "terms-of-service": {
      "v1_hash_xyz": "2024-08-15T10:00:00Z"
    }
  }
}
```

### Advantages

- **Complete History:** Provides a full audit trail of every policy version a user has accepted.
- **Improved Auditing:** Allows us to definitively answer "Did user X accept version Y of the privacy policy?" for any version, not just the latest.
- **Future-Proofing:** Enables building features that may rely on knowing if a user has seen a specific version of a document.

## 4. High-Level Implementation Plan

This change will impact data schemas, backend logic for policy acceptance, and any frontend components that read or interact with this data.

1.  **Update Schemas:**
    -   Modify the Zod schemas in `packages/shared/` and `firebase/functions/src/schemas/` to reflect the new nested map structure.
    -   Update the corresponding TypeScript types (`shared-types.ts`).

2.  **Backend Logic (`UserPolicyService`):**
    -   The `acceptPolicies` function must be updated. Instead of overwriting the `VersionHash` for a given `PolicyId`, it should add a new entry to the inner map for the new `VersionHash` with the current server timestamp.

3.  **Data Hydration/Transformation:**
    -   Any logic that reads `acceptedPolicies` (e.g., to determine if a user needs to accept new policies) will need to be adjusted. Instead of a direct hash comparison, it will need to check for the existence of the *current* policy hash within the inner map for that `PolicyId`.

4.  **API Payloads:**
    -   Review and update any API endpoints that return or accept `acceptedPolicies` to ensure they conform to the new structure. This includes public user profiles and admin-related user data endpoints.

5.  **Data Migration:** ~~(Optional but Recommended)~~
    -   ~~A migration script should be written to update existing user documents in Firestore.~~
    -   **Not required** - no existing data to migrate.

## 5. Stakeholders

-   **Backend:** Firestore data structure, services, API.
-   **Frontend:** Logic for displaying policy banners/modals and handling acceptance.
-   **QA/Testing:** Tests will need significant updates to reflect the new data shape and logic.

## 6. Detailed Implementation Plan

### Implementation Order

#### Phase 1: Type Definitions (causes compile errors that guide remaining changes)

**Step 1: `packages/shared/src/shared-types.ts`** (line 599)
```typescript
// Before:
acceptedPolicies?: Record<PolicyId, VersionHash>;

// After:
acceptedPolicies?: Record<PolicyId, Record<VersionHash, ISOString>>;
```

**Step 2: `firebase/functions/src/services/firestore/IFirestoreWriter.ts`** (line 41)
```typescript
// Before:
acceptedPolicies?: Record<string, string>;

// After:
acceptedPolicies?: Record<string, Record<string, string>>;
```

#### Phase 2: Schema Updates

**Step 3: `firebase/functions/src/schemas/user.ts`** (line 18)
```typescript
// Add import: toISOString from @billsplit-wl/shared

// Before:
acceptedPolicies: z.record(PolicyIdSchema, VersionHashSchema).optional(),

// After:
acceptedPolicies: z.record(
    PolicyIdSchema,
    z.record(VersionHashSchema, z.string().datetime().transform(toISOString))
).optional(),
```

**Step 4: `packages/shared/src/schemas/apiSchemas.ts`** (line 398)
```typescript
// Before:
acceptedPolicies: z.record(z.string(), z.string()).optional(),

// After:
acceptedPolicies: z.record(z.string(), z.record(z.string(), z.string())).optional(),
```

#### Phase 3: Service Logic

**Step 5: `firebase/functions/src/services/UserPolicyService.ts`**

Update `_acceptMultiplePolicies` (lines 50-98) to use transaction for atomicity:
- Add import: `isoStringNow` from `@billsplit-wl/shared`, `FirestoreCollections` from constants
- Use `firestoreWriter.runTransaction()` to atomically read-modify-write
- Use `getDocumentReferenceInTransaction()` to get user doc ref
- Build updated policies map preserving history (no-op if version already accepted)

Update `getUserPolicyStatus` (lines 115-123):
```typescript
// Before:
const userAcceptedHash = userAcceptedPolicies[policyId] as VersionHash | undefined;
const needsAcceptance = !userAcceptedHash || userAcceptedHash !== currentVersionHash;

// After:
const policyHistory = (userAcceptedPolicies[policyId] ?? {}) as Record<VersionHash, string>;
const hasAcceptedCurrentVersion = currentVersionHash in policyHistory;
const needsAcceptance = !hasAcceptedCurrentVersion;
const userAcceptedHash = hasAcceptedCurrentVersion ? currentVersionHash : undefined;
```

**Step 6: `firebase/functions/src/services/UserService2.ts`** (lines 593-611)

Update `getCurrentPolicyVersions` return type and implementation:
```typescript
// Before:
private async getCurrentPolicyVersions(): Promise<Record<string, string>>
acceptedPolicies[policy.id] = policy.currentVersionHash;

// After:
private async getCurrentPolicyVersions(): Promise<Record<string, Record<string, string>>>
const now = toISOString(new Date().toISOString());
acceptedPolicies[policy.id] = { [policy.currentVersionHash]: now };
```

#### Phase 4: Test Builders

**Step 7: `packages/test-support/src/builders/UserProfileBuilder.ts`** (line 69)
```typescript
// Before:
withAcceptedPolicies(policies: Record<PolicyId, VersionHash>): this

// After:
withAcceptedPolicies(policies: Record<PolicyId, Record<VersionHash, ISOString>>): this
```

**Step 8: `packages/test-support/src/builders/AdminUserProfileBuilder.ts`** (line 85)
Same change as above.

#### Phase 5: Test Updates

**Step 9: `firebase/functions/src/__tests__/unit/api/users.test.ts`**
- Update any test fixtures using old `acceptedPolicies` format
- Add new test cases:
  - Re-acceptance of same version preserves original timestamp (no-op)
  - Accepting new version preserves old version in history

### Key Implementation Details

#### Transaction Pattern
Use existing `IFirestoreWriter` methods:
- `runTransaction<T>(updateFunction: (transaction: ITransaction) => Promise<T>): Promise<T>`
- `getDocumentReferenceInTransaction(transaction, collection, documentId): IDocumentReference`

#### Re-acceptance Behavior
If a user accepts the same policy version twice, preserve the original timestamp (no-op).

#### Timestamp Storage
ISO strings stored as plain strings in Firestore (not converted to Firestore Timestamps). This is audit data.

### Verification

After implementation:
```bash
npm run build
cd firebase/functions && npx vitest run src/__tests__/unit/api/users.test.ts -t "policy"
```

---

## 7. Sanity Check Notes (2025-11-25)

### Verified Correct
- All file locations and line numbers are accurate
- All "Before" code snippets match the codebase
- The proposed data structure change is sound

### Corrections Applied
1. **Race condition fixed:** Changed from read-modify-write to Firestore transaction
2. **Missing schema noted:** `ISOStringSchema` needs to be created inline as `z.string().datetime().transform(toISOString)`
3. **Null check added:** Handle user not found case
4. **Re-acceptance behavior defined:** No-op (preserve original timestamp)
5. **Migration removed:** Not required (no existing data)

---

## 8. Implementation Notes (2025-11-27)

### Files Modified

| File | Change |
|------|--------|
| `packages/shared/src/shared-types.ts` | Changed `acceptedPolicies` type to nested record |
| `firebase/functions/src/services/firestore/IFirestoreWriter.ts` | Updated interface type |
| `firebase/functions/src/schemas/user.ts` | Updated Zod schema with nested record and `toISOString` import |
| `packages/shared/src/schemas/apiSchemas.ts` | Updated API response schema |
| `firebase/functions/src/services/UserPolicyService.ts` | Rewrote `_acceptMultiplePolicies` with transactions, updated `getUserPolicyStatus` |
| `firebase/functions/src/services/UserService2.ts` | Updated `getCurrentPolicyVersions`, removed outdated type cast |
| `firebase/functions/src/browser/UserBrowserHandlers.ts` | Removed outdated type cast |
| `packages/test-support/src/builders/UserProfileBuilder.ts` | Updated method signature |
| `packages/test-support/src/builders/AdminUserProfileBuilder.ts` | Updated method signature |
| `firebase/functions/src/__tests__/unit/api/users.test.ts` | Updated test mocks and expectations |

### Test Updates

Two existing tests required adjustment:
1. **"should propagate error when Firestore write fails"** - Changed mock from `updateUser` to `runTransaction`
2. **"should show pending when user has accepted old versions"** - Updated expectation: `userAcceptedHash` is now `undefined` when user hasn't accepted the current version (correct behavior for history-based model)

Two new tests added for history-specific behavior:
1. **"should preserve original timestamp when re-accepting same version (no-op)"** - Verifies re-acceptance doesn't create duplicate entries
2. **"should preserve history when accepting new policy version"** - Verifies accepting v2 doesn't lose record of v1 acceptance

### Verification

- ✅ `npm run build` passes
- ✅ All 29 policy-related tests pass (`npx vitest run src/__tests__/unit/api/users.test.ts -t "policy"`)
  - 2 new tests added for history-specific behavior

### Key Behaviors Implemented

1. **Transaction-based writes**: Policy acceptance uses Firestore transactions to prevent race conditions
2. **History preservation**: Re-accepting the same version is a no-op (preserves original timestamp)
3. **ISO string timestamps**: Stored as plain strings in Firestore (audit data, not converted to Firestore Timestamps)
4. **`userAcceptedHash` semantics**: Returns `currentVersionHash` if user has accepted it, `undefined` otherwise
5. **API returns actual timestamp**: For re-acceptance, API returns the original stored timestamp, not the current time
