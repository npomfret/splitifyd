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
