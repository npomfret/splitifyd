# Report on Optional and Nullable Fields in Shared Types

## 1. Introduction

This report details the investigation into optional (`?`) and nullable (`| null`) fields within the type definitions in `packages/shared/src/shared-types.ts`. The analysis covered the usage of these types across both the frontend (`webapp-v2`) and backend (`firebase/functions`) to determine if the optionality is correct or represents unnecessary defensive programming.

**Context:** This is a **clean system with no legacy data**. All types should accurately reflect the backend's guaranteed behavior, with no "just in case" optionals.

---

## 2. Summary of Findings

**UPDATED CONCLUSION (Post-Fix):**

The investigation revealed **6 genuine type inconsistencies** where optional fields should have been required. All have been fixed:

1. ✅ **FIXED:** `RegisteredUser.role` - Now explicitly required
2. ✅ **FIXED:** `RegisteredUser.displayName` - Now explicitly required
3. ✅ **FIXED:** `ExpenseDTO.isLocked` - Made required (always computed by backend)
4. ✅ **FIXED:** `SettlementDTO.isLocked` - Made required (always computed by backend)
5. ✅ **FIXED:** `SettlementWithMembers.isLocked` - Made required (always computed by backend)
6. ✅ **FIXED:** `ActivityFeedItem.createdAt` - Made required (always set by AuditFieldsSchema)

**Remaining optional fields are CORRECT and serve legitimate purposes:**

1. **Computed, Server-Side Fields (conditionally present):** `balance`, `lastActivity` on deleted groups
2. **Truly Optional User Data:** `description`, `receiptUrl`, `note`, `authorAvatar`
3. **Standard Soft-Deletion:** `deletedAt: ISOString | null` (intentional - tracks explicit state)
4. **Evolving Schemas:** `permissionHistory`, `inviteLinks` (added over time)

---

## 3. Detailed Analysis of Fixed Types

### 3.1. `RegisteredUser` - ✅ FIXED

**Original Issue:**
- `role` was declared required in the interface but **missing from registration response**
- `displayName` was inherited but not explicitly documented as required

**Root Cause:**
- Registration endpoint (`UserService2.registerUser()`) returned user WITHOUT role field
- Type assertion `as RegisteredUser` hid the bug

**Fix Applied:**
```typescript
// packages/shared/src/shared-types.ts
export interface RegisteredUser extends FirebaseUser {
    // Core required fields (explicitly declared for clarity)
    displayName: DisplayName; // Inherited from FirebaseUser -> BaseUser, but explicitly required
    email: Email;
    role: SystemUserRole; // Required for all registered users (default: SYSTEM_USER)
    // ...
}
```

```typescript
// firebase/functions/src/services/UserService2.ts (line 532)
return {
    uid: userRecord.uid,
    displayName: userRecord.displayName ?? userRegistration.displayName,
    email: (userRecord.email ?? userRegistration.email) as Email,
    emailVerified: userRecord.emailVerified ?? false,
    photoURL: userRecord.photoURL ?? null,
    role: SystemUserRoles.SYSTEM_USER, // ✅ NOW INCLUDED
} as RegisteredUser;
```

**Validation:** All new user registrations now correctly return complete user objects with role.

---

### 3.2. `ExpenseDTO.isLocked` - ✅ FIXED

**Original Issue:**
- `isLocked` was optional (`isLocked?: boolean`)
- Backend computed it for GET/LIST operations but **NOT for CREATE/UPDATE**
- API inconsistency - same endpoint returned different shapes

**Root Cause:**
- Defensive optional typing for a field that should always be present
- Incomplete implementation - missing from write operations

**Fix Applied:**
```typescript
// packages/shared/src/shared-types.ts (line 872)
export interface ExpenseDTO extends Expense, BaseDTO<ExpenseId> {
    isLocked: boolean; // ✅ Now required (was: isLocked?: boolean)
}
```

```typescript
// firebase/functions/src/services/ExpenseService.ts

// CREATE (line 202)
const expense: ExpenseDTO = {
    // ... other fields
    isLocked: false, // ✅ New expenses are never locked initially
};

// UPDATE (lines 478-479)
const normalizedExpense = this.normalizeValidatedExpense(updatedExpense);
normalizedExpense.isLocked = await this.isExpenseLocked(normalizedExpense); // ✅ Computed
return normalizedExpense;
```

**Validation:** All expense responses now consistently include `isLocked` field.

---

### 3.3. `SettlementDTO.isLocked` - ✅ FIXED

**Original Issue:**
- Same as ExpenseDTO - optional field, inconsistent API

**Fix Applied:**
```typescript
// packages/shared/src/shared-types.ts (line 917)
export interface SettlementDTO extends Settlement, BaseDTO<SettlementId> {
    isLocked: boolean; // ✅ Now required (was: isLocked?: boolean)
}
```

```typescript
// firebase/functions/src/services/SettlementService.ts

// CREATE (line 135)
const settlementDataToCreate: Omit<SettlementDTO, 'id'> = {
    // ... other fields
    isLocked: false, // ✅ New settlements are never locked initially
};

// UPDATE (lines 422-423)
const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(settlement.groupId);
settlementWithMembers.isLocked = !currentMemberIds.includes(payerData.uid) || !currentMemberIds.includes(payeeData.uid);
```

**Validation:** All settlement responses now consistently include `isLocked` field.

---

### 3.4. `SettlementWithMembers.isLocked` - ✅ FIXED

**Original Issue:**
- Separate type for settlement lists, same issue as SettlementDTO

**Fix Applied:**
```typescript
// packages/shared/src/shared-types.ts (line 962)
export interface SettlementWithMembers extends SoftDeletable {
    // ... other fields
    isLocked: boolean; // ✅ Now required (was: isLocked?: boolean)
}
```

---

### 3.5. `ActivityFeedItem.createdAt` - ✅ FIXED

**Original Issue:**
- Backend schema (`ActivityFeedDocumentSchema`) requires `createdAt` via `AuditFieldsSchema`
- Every activity feed document has this field by definition
- Frontend type incorrectly marked it optional

**Fix Applied:**
```typescript
// packages/shared/src/shared-types.ts (line 244)
export interface ActivityFeedItem {
    // ... other fields
    createdAt: ISOString; // ✅ Now required (was: createdAt?: ISOString)
}
```

```typescript
// webapp-v2/src/app/gateways/activity-feed-gateway.ts (lines 83-86)
const createdAt = this.toISOString(data.createdAt, 'createdAt');
if (!createdAt) {
    throw new Error('Activity feed document missing createdAt');
}
```

**Validation:** Frontend now enforces that activity feed items always have `createdAt`, matching backend guarantee.

---

## 4. Analysis of Correctly Optional Types

### 4.1. `GroupDTO`

**Correctly optional fields:**

- `description?: string` - Truly optional user input
- `permissionHistory?: PermissionChangeLog[]` - Groups may have no permission changes
- `inviteLinks?: Record<string, InviteLink>` - Groups may have no invite links
- `balance?: { ... }` - **Computed field, optional for deleted groups**
  - Active groups: Always computed by `GroupService.addComputedFields()`
  - Deleted groups: Skipped (line 154-156 in GroupService.ts)
  - **Correct** - deleted groups don't need balance calculations
- `lastActivity?: string` - **Computed field, optional for deleted groups** (same reasoning as balance)

**Verdict:** ✅ All correct, no changes needed

---

### 4.2. `ExpenseDTO`

**Correctly optional fields:**

- `receiptUrl?: string` - Users not required to upload receipts

**Verdict:** ✅ Correct, no changes needed

---

### 4.3. `SettlementDTO`

**Correctly optional fields:**

- `note?: string` - Users not required to add notes to settlements

**Verdict:** ✅ Correct, no changes needed

---

### 4.4. Soft-Delete Pattern

**Pattern:** `deletedAt: ISOString | null`, `deletedBy: UserId | null`

**Justification:**
- `| null` explicitly tracks state: `null` = active, `ISOString` = deleted timestamp
- Different from optional (`?`) which means "field might not exist"
- This pattern ensures field always exists with explicit active/deleted state
- Standard practice for soft-delete implementations

**Verdict:** ✅ Correct pattern, keep `| null`

---

## 5. Implementation Summary

### Files Changed

**Type Definitions:**
- `packages/shared/src/shared-types.ts`
  - Made `ExpenseDTO.isLocked` required
  - Made `SettlementDTO.isLocked` required
  - Made `SettlementWithMembers.isLocked` required
  - Made `ActivityFeedItem.createdAt` required
  - Explicitly documented `RegisteredUser.role` and `displayName` as required

**Backend Services:**
- `firebase/functions/src/services/UserService2.ts`
  - Added `role` to registration response

- `firebase/functions/src/services/ExpenseService.ts`
  - Set `isLocked: false` on expense creation
  - Compute `isLocked` on expense update

- `firebase/functions/src/services/SettlementService.ts`
  - Set `isLocked: false` on settlement creation
  - Compute `isLocked` on settlement update

**Frontend Gateways:**
- `webapp-v2/src/app/gateways/activity-feed-gateway.ts`
  - Enforce `createdAt` is always present
  - Throw error if missing

### Verification

✅ **TypeScript Compilation:** Clean (no errors)
✅ **Type Safety:** Improved - no "just in case" optionals
✅ **API Consistency:** All computed fields always present in responses
✅ **Backend Guarantees:** Types now match actual backend behavior

---

## 6. Final Conclusion

**Original Report Conclusion Was Incorrect:**

The original conclusion stated that optional fields were "correctly and intentionally used" and represented good architectural decisions. This was **wrong for a system with no legacy data**.

**Corrected Conclusion:**

With no legacy users and no existing production data, the defensive optional typing was **unnecessary**. The fixes properly align types with backend guarantees:

1. **Computed fields** that are ALWAYS computed should be **required**
2. **Core user fields** that are ALWAYS set during registration should be **required**
3. **Audit fields** that are ALWAYS set by schemas should be **required**

The only legitimate optional fields are:
- Truly optional user input (descriptions, notes, receipts)
- Conditional computed fields (balance/lastActivity on deleted groups)
- Soft-delete state tracking (`| null` pattern)

**Result:** The codebase now has properly enforced required types with no defensive optionals for non-existent legacy scenarios.
