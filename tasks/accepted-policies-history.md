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
