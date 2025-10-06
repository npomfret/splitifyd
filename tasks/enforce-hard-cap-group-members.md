# Enforce Hard Cap on Group Members

## 1. Overview

Currently, `getAllGroupMembers()` in the FirestoreReader can theoretically fetch an unbounded number of members. While real-world expense groups rarely exceed 50 members, the lack of enforcement creates a potential failure point for edge cases and allows silent partial data returns if Firestore query limits are hit.

## 2. The Problem: Unbounded Collection Queries

- **No Upper Limit:** The `getAllGroupMembers()` method has no maximum limit, making it susceptible to the same pagination issues as expenses and settlements.
- **Silent Failures:** If a group somehow exceeds Firestore's default query limit, the method would return incomplete data without warning.
- **No Business Logic Enforcement:** There's no technical constraint preventing groups from growing beyond reasonable sizes.
- **Consistency:** While expenses/settlements will have required pagination, group members should either have a hard cap or also require pagination.

## 3. The Solution: Enforce Maximum Group Size

Implement a hard cap on group size at the application level with explicit error handling.

### 3.1. Implementation Details

#### Hard Cap Configuration
```typescript
// In a shared constants file
export const MAX_GROUP_MEMBERS = 500;
```

**Rationale for 500:**
- Real-world expense groups: typically 2-20 members
- Large scenarios (company outings, shared houses): 20-100 members
- Edge cases (clubs, large events): 100-500 members
- Beyond 500: Unrealistic for expense splitting use case

#### Updated `getAllGroupMembers()` Method

```typescript
async getAllGroupMembers(groupId: string): Promise<GroupMembershipDTO[]> {
    const snapshot = await this.db
        .collection('group-memberships')
        .where('groupId', '==', groupId)
        .limit(MAX_GROUP_MEMBERS + 1)  // Fetch one extra to detect overflow
        .get();

    if (snapshot.size > MAX_GROUP_MEMBERS) {
        throw new ApiError(
            'GROUP_TOO_LARGE',
            `Group exceeds maximum size of ${MAX_GROUP_MEMBERS} members`,
            400
        );
    }

    return snapshot.docs.map(doc => this.convertToDTO(doc));
}
```

#### Enforce at Creation Time

Also enforce the limit when adding members to prevent groups from growing beyond the cap:

```typescript
// In GroupService.addMember() or similar
async addMember(groupId: string, userId: string): Promise<void> {
    const currentMembers = await this.firestoreReader.getAllGroupMembers(groupId);

    if (currentMembers.length >= MAX_GROUP_MEMBERS) {
        throw new ApiError(
            'GROUP_AT_CAPACITY',
            `Cannot add member. Group has reached maximum size of ${MAX_GROUP_MEMBERS} members`,
            400
        );
    }

    // Proceed with adding member...
}
```

### 3.2. Related Methods to Update

The following methods also need the hard cap enforced:

1. `getAllGroupMemberIds(groupId: string): Promise<string[]>` - Apply same limit
2. Any batch member fetch operations

### 3.3. Benefits of Hard Cap Approach

✅ **Simple API:** Callers don't need pagination loops for member lists
✅ **Fail Loudly:** Explicit error if limit exceeded (no silent partial data)
✅ **Reasonable Limit:** 500 members is far beyond typical usage
✅ **Business Logic:** Enforces sensible application constraints
✅ **Consistency:** Clear boundary between "bounded" and "unbounded" collections

### 3.4. Alternative: Required Pagination

If we decide groups can exceed 500 members, the alternative is to make members a paginated collection like expenses:

```typescript
// Option B: Pagination instead of hard cap
getGroupMembersPaginated(
    groupId: string,
    options: { limit: number; cursor?: string }
): Promise<{ members: GroupMembershipDTO[]; hasMore: boolean; nextCursor?: string }>
```

**Downsides:**
- Every caller (balance calculations, permission checks, etc.) must implement pagination loops
- More complex for common operations
- Doesn't match real-world usage patterns

## 4. Implementation Steps

1. **Define constant:** Add `MAX_GROUP_MEMBERS = 500` to shared constants
2. **Update `getAllGroupMembers()`:** Add limit check with overflow detection
3. **Update `getAllGroupMemberIds()`:** Add same limit check
4. **Enforce at member addition:** Check count before adding new members
5. **Add tests:**
   - Test group with exactly 500 members (should succeed)
   - Test group with 501 members (should throw error)
   - Test adding member to full group (should reject)
6. **Update API error documentation:** Document `GROUP_TOO_LARGE` and `GROUP_AT_CAPACITY` error codes

## 5. Testing Strategy

### Unit Tests

```typescript
describe('getAllGroupMembers with hard cap', () => {
    it('should return all members when under limit', async () => {
        // Create group with 100 members
        const members = await firestoreReader.getAllGroupMembers(groupId);
        expect(members).toHaveLength(100);
    });

    it('should throw error when group exceeds 500 members', async () => {
        // Create group with 501 members
        await expect(
            firestoreReader.getAllGroupMembers(groupId)
        ).rejects.toThrow('GROUP_TOO_LARGE');
    });

    it('should handle exactly 500 members correctly', async () => {
        // Create group with exactly 500 members
        const members = await firestoreReader.getAllGroupMembers(groupId);
        expect(members).toHaveLength(500);
    });
});
```

### Integration Tests

```typescript
it('should prevent adding member to full group', async () => {
    // Create group with 500 members
    await expect(
        groupService.addMember(groupId, newUserId)
    ).rejects.toThrow('GROUP_AT_CAPACITY');
});
```

## 6. Acceptance Criteria

- ✅ `getAllGroupMembers()` throws explicit error if group has > 500 members
- ✅ `getAllGroupMemberIds()` enforces same limit
- ✅ Cannot add member to group at capacity (500 members)
- ✅ Error messages are clear and actionable
- ✅ Tests verify boundary conditions (499, 500, 501 members)
- ✅ Documentation updated with new error codes

## 7. Future Considerations

If 500 members proves insufficient, options include:

1. **Increase the cap** to 1000 or 5000 (simple config change)
2. **Implement pagination** for member lists (more complex)
3. **Different product:** Groups exceeding 500 members likely need enterprise expense management, not a simple splitting app

## 8. Related Tasks

- **Prerequisite:** None
- **Blocks:** `bug-incomplete-pagination-in-balance-calculation.md` (this ensures member counts are always accurate)
- **Related:** `improve-data-modeling.md` (group size limits affect data model design)

---

## 9. ✅ IMPLEMENTATION COMPLETE (January 2025)

**Status**: Implemented and tested
**Cap**: 50 members (changed from original 500)
**Approach**: Simple check-and-fail (no `memberCount` field)

### Summary
Hard cap enforcement implemented using a straightforward approach:
1. Check member count before adding new members
2. Throw explicit error if at capacity
3. Overflow detection for edge cases
4. Fast unit tests verify boundary conditions

### Files Modified
- `packages/shared/src/constants.ts` - Added `MAX_GROUP_MEMBERS = 50`
- `firebase/functions/src/services/GroupShareService.ts` - Added capacity check
- `firebase/functions/src/services/firestore/FirestoreReader.ts` - Added overflow detection
- `firebase/functions/src/__tests__/unit/services/GroupShareService.test.ts` - Added tests
- `firebase/functions/src/__tests__/unit/mocks/firestore-stubs.ts` - Added test helpers

### Test Results
All unit tests passing (7/7) in ~7ms:
- ✅ 49 members → can add (at capacity-1)
- ✅ 50 members → fails with `GROUP_AT_CAPACITY`
- ✅ 51+ members → fails with `GROUP_TOO_LARGE` (overflow detection)

---

## 10. Implementation Review & Refinements

### ✅ Strengths
- Clear problem definition with well-articulated silent failure risks
- Pragmatic 500-member limit covers edge cases beyond typical usage
- Elegant overflow detection using `limit(MAX_GROUP_MEMBERS + 1)`
- Dual enforcement at read and write operations
- Aligns with codebase "fail loudly" philosophy

### 🔧 Refinements to Implement

#### 1. Race Condition Prevention
**Issue**: Check-then-add pattern in `addMember` has race condition:
```typescript
const currentMembers = await getAllGroupMembers(groupId);
if (currentMembers.length >= MAX_GROUP_MEMBERS) { throw ... }
// Another request could add member here ← RACE CONDITION
await addMember(...);
```

**Solution**: Use Firestore transaction with `memberCount` field for atomic enforcement.

#### 2. Performance Optimization: `memberCount` Field
Instead of counting members on each check, maintain atomic counter in group document:
- Increment via transaction when adding members
- Decrement when removing members
- Enables O(1) capacity check vs O(n) member fetch

#### 3. Edge Case: Existing Large Groups
Define behavior if groups already exceed 500 members when deployed:
- Read operations throw `GROUP_TOO_LARGE` error
- No new members can be added
- Document this as expected behavior (not a migration concern for greenfield project)

#### 4. Client Error Handling Guidance
**`GROUP_TOO_LARGE`**: Group data becomes read-only, show user-friendly message
**`GROUP_AT_CAPACITY`**: Prevent member addition, suggest removing inactive members

### Implementation Plan (Revised - Simple Approach)

**Decision**: No `memberCount` field. Simple check-and-fail approach.

1. ✅ **Create constants file** with `MAX_GROUP_MEMBERS = 50`
2. ✅ **Update GroupShareService.joinGroupByLink()** - check count before adding member
3. ✅ **Update FirestoreReader.getAllGroupMembers()** - overflow detection with `limit(51)`
4. ✅ **Update FirestoreReader.getAllGroupMemberIds()** - delegate to getAllGroupMembers for DRY
5. ✅ **Add unit tests** - boundary conditions (49, 50, 51 members)
6. ✅ **Build verification** - all changes compile successfully

### Actual Implementation

#### 1. Constant Definition
**File**: `packages/shared/src/constants.ts`
```typescript
export const MAX_GROUP_MEMBERS = 50;
```

#### 2. Enforcement at Join
**File**: `firebase/functions/src/services/GroupShareService.ts:223-230`
```typescript
// Enforce hard cap on group size
if (existingMembers.length >= MAX_GROUP_MEMBERS) {
    throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'GROUP_AT_CAPACITY',
        `Cannot add member. Group has reached maximum size of ${MAX_GROUP_MEMBERS} members`
    );
}
```

#### 3. Overflow Detection in Reader
**File**: `firebase/functions/src/services/firestore/FirestoreReader.ts:586-600`
```typescript
// Fetch one extra to detect overflow
const membersQuery = this.db
    .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
    .where('groupId', '==', groupId)
    .limit(MAX_GROUP_MEMBERS + 1);

const snapshot = await membersQuery.get();

// Detect overflow - group exceeds maximum size - should never happen!
if (snapshot.size > MAX_GROUP_MEMBERS) {
    throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'GROUP_TOO_LARGE',
        `Group exceeds maximum size of ${MAX_GROUP_MEMBERS} members`
    );
}
```

#### 4. DRY Implementation
**File**: `firebase/functions/src/services/firestore/FirestoreReader.ts:568-574`
```typescript
async getAllGroupMemberIds(groupId: string): Promise<string[]> {
    return measureDb('GET_MEMBER_IDS', async () => {
        // Delegate to getAllGroupMembers for DRY and consistent hard cap enforcement
        const members = await this.getAllGroupMembers(groupId);
        return members.map(member => member.uid);
    });
}
```

#### 5. Unit Tests
**File**: `firebase/functions/src/__tests__/unit/services/GroupShareService.test.ts:99-192`

Tests added:
- ✅ `should succeed when group has 49 members` - Can add at capacity-1
- ✅ `should fail when group already has 50 members` - Throws `GROUP_AT_CAPACITY`
- ✅ `should detect overflow in getAllGroupMembers when group has > 50` - Throws `GROUP_TOO_LARGE`

All tests pass in ~7ms using stubs (no database required).

### Error Codes

| Error Code | HTTP Status | Description | When Thrown |
|------------|-------------|-------------|-------------|
| `GROUP_AT_CAPACITY` | 400 | Cannot add member, group at 50-member limit | When trying to join a group that already has 50 members |
| `GROUP_TOO_LARGE` | 400 | Group exceeds 50 members (edge case) | When `getAllGroupMembers()` detects > 50 members (should never happen in practice) |
