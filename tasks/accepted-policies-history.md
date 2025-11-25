# Task: Store a History of Accepted Policies

**Author:** Gemini
**Date:** 2025-11-24
**Status:** Proposed

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

5.  **Data Migration (Optional but Recommended):**
    -   A migration script should be written to update existing user documents in Firestore. For current records, the script would transform `policyId: versionHash` into `policyId: { versionHash: <timestamp> }`. The timestamp could be the user's `updatedAt` field or a new timestamp generated at the time of migration, though the former is preferable if accurate. This is a lossy migration in terms of the acceptance date, but it brings the data into the new format. All new acceptances going forward will have an accurate timestamp.

## 5. Stakeholders

-   **Backend:** Firestore data structure, services, API.
-   **Frontend:** Logic for displaying policy banners/modals and handling acceptance.
-   **QA/Testing:** Tests will need significant updates to reflect the new data shape and logic.

## 6. Detailed Implementation Plan

### Files to Modify

#### 6.1 Type Definitions
**`packages/shared/src/shared-types.ts`** (line 599)
```typescript
// Before:
acceptedPolicies?: Record<PolicyId, VersionHash>;

// After:
acceptedPolicies?: Record<PolicyId, Record<VersionHash, ISOString>>;
```

#### 6.2 Zod Schemas

**`firebase/functions/src/schemas/user.ts`** (line 18)
```typescript
// Before:
acceptedPolicies: z.record(PolicyIdSchema, VersionHashSchema).optional(),

// After:
acceptedPolicies: z.record(PolicyIdSchema, z.record(VersionHashSchema, ISOStringSchema)).optional(),
```

**`packages/shared/src/schemas/apiSchemas.ts`** (line 404)
```typescript
// Before:
acceptedPolicies: z.record(z.string(), z.string()).optional(),

// After:
acceptedPolicies: z.record(z.string(), z.record(z.string(), z.string())).optional(),
```

#### 6.3 Firestore Interface
**`firebase/functions/src/services/firestore/IFirestoreWriter.ts`** (line 41)
```typescript
// Before:
acceptedPolicies?: Record<string, string>;

// After:
acceptedPolicies?: Record<string, Record<string, string>>;
```

#### 6.4 Service Layer

**`firebase/functions/src/services/UserPolicyService.ts`**

**Accept policies (lines 65-72)** - change from overwriting to adding:
```typescript
// Before:
const acceptedPolicies: Record<string, string> = {};
acceptances.forEach((acceptance) => {
    acceptedPolicies[acceptance.policyId] = acceptance.versionHash;
});

// After:
const user = await this.firestoreReader.getUser(userId);
const now = new Date().toISOString();
const existingPolicies = user?.acceptedPolicies ?? {};
const acceptedPolicies: Record<string, Record<string, string>> = { ...existingPolicies };
acceptances.forEach((acceptance) => {
    acceptedPolicies[acceptance.policyId] = {
        ...(acceptedPolicies[acceptance.policyId] ?? {}),
        [acceptance.versionHash]: now,
    };
});
```

**Get policy status (lines 115-123)** - check if current version exists in history:
```typescript
// Before:
const userAcceptedHash = userAcceptedPolicies[policyId] as VersionHash | undefined;
const needsAcceptance = !userAcceptedHash || userAcceptedHash !== currentVersionHash;

// After:
const policyHistory = userAcceptedPolicies[policyId] ?? {};
const hasAcceptedCurrentVersion = currentVersionHash in policyHistory;
const needsAcceptance = !hasAcceptedCurrentVersion;
// For userAcceptedHash in DTO, return currentVersionHash if accepted, else undefined
const userAcceptedHash = hasAcceptedCurrentVersion ? currentVersionHash : undefined;
```

#### 6.5 User Registration
**`firebase/functions/src/services/UserService2.ts`** (lines 601-619)
```typescript
// Before:
acceptedPolicies[policy.id] = policy.currentVersionHash;

// After:
const now = new Date().toISOString();
acceptedPolicies[policy.id] = { [policy.currentVersionHash]: now };
```

Also update return type from `Record<string, string>` to `Record<string, Record<string, string>>`.

#### 6.6 Admin/Browser Handlers
- **`firebase/functions/src/admin/UserAdminHandlers.ts`** (line 68) - remove `as any` cast
- **`firebase/functions/src/browser/UserBrowserHandlers.ts`** (line 176) - update type cast

#### 6.7 Test Builders
- **`packages/test-support/src/builders/UserProfileBuilder.ts`** (line 69)
- **`packages/test-support/src/builders/AdminUserProfileBuilder.ts`** (line 85)

Update method signatures:
```typescript
// Before:
withAcceptedPolicies(policies: Record<PolicyId, VersionHash>): this

// After:
withAcceptedPolicies(policies: Record<PolicyId, Record<VersionHash, ISOString>>): this
```

#### 6.8 Tests to Update
- `firebase/functions/src/__tests__/unit/api/users.test.ts` - update assertions for new structure
- Any test fixtures using old `acceptedPolicies` format

### Implementation Order

1. `shared-types.ts` - change the type (causes compile errors that guide remaining changes)
2. `user.ts` schema, `apiSchemas.ts`, `IFirestoreWriter.ts` - fix schema/interface types
3. `UserPolicyService.ts` - update write and read logic
4. `UserService2.ts` - update registration
5. Handler files - fix type casts
6. Test builders and test files

### Testing

Run after implementation:
```bash
npx vitest run firebase/functions/src/__tests__/unit/api/users.test.ts
npx vitest run firebase/functions/src/__tests__/unit/services/PolicyService.test.ts
```
