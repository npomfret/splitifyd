# Group Membership Collection Migration Plan

## Overview

This document outlines the comprehensive migration from the current **subcollection-based** group membership structure (`groups/{groupId}/members/{userId}`) to a **top-level collection** structure (`group_memberships/{membershipId}`) for improved scalability and query performance.

## Current State Analysis

### Architecture Problem
The current system stores group members in subcollections:
- Path: `groups/{groupId}/members/{userId}` 
- **Scalability Issues**: Limited to collectionGroup queries for user's groups
- **Performance Issues**: No efficient way to query user memberships with group metadata
- **Complexity**: Requires multiple database calls to get user's groups with metadata

### Target Architecture
New top-level collection structure:
- Path: `group_memberships/{membershipId}`
- **Benefits**: Direct queries, denormalized group metadata, efficient pagination
- **Enhanced Queries**: User groups sorted by group update time
- **Reduced Complexity**: Single query for user's groups with metadata

## Data Model Changes

### Current: GroupMemberDocument (Subcollection)
```typescript
interface GroupMemberDocument {
    userId: string;
    groupId: string;
    memberRole: MemberRoles;
    theme: UserThemeColor;
    joinedAt: string;
    memberStatus: MemberStatuses;
    invitedBy?: string;
    lastPermissionChange?: string;
}
```

### New: GroupMembershipDocument (Top-level Collection)
```typescript
interface GroupMembershipDocument {
    id: string;                    // membership-{userId}-{groupId}
    userId: string;
    groupId: string;
    groupName: string;             // DENORMALIZED for efficiency
    groupUpdatedAt: string;        // DENORMALIZED for sorting
    memberRole: MemberRoles;
    theme: UserThemeColor;
    joinedAt: string;
    memberStatus: MemberStatuses;
    addedBy: string;              // Who added this member
    invitedBy?: string;           // If joined via invite link
    lastPermissionChange?: string;
    createdAt: string;
    updatedAt: string;
}
```

### Key Differences
1. **Denormalized Fields**: `groupName`, `groupUpdatedAt` for efficient queries
2. **Audit Fields**: `createdAt`, `updatedAt` for tracking
3. **Document ID**: Composite key `membership-{userId}-{groupId}`
4. **Additional Metadata**: `addedBy` field for membership tracking

## Database Schema Changes

### Firestore Indexes Required
```json
{
  "collectionGroup": "group_memberships",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "userId", "order": "ASCENDING"},
    {"fieldPath": "groupUpdatedAt", "order": "DESCENDING"}
  ]
},
{
  "collectionGroup": "group_memberships", 
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "groupId", "order": "ASCENDING"},
    {"fieldPath": "joinedAt", "order": "ASCENDING"}
  ]
},
{
  "collectionGroup": "group_memberships",
  "queryScope": "COLLECTION", 
  "fields": [
    {"fieldPath": "userId", "order": "ASCENDING"},
    {"fieldPath": "groupId", "order": "ASCENDING"}
  ]
}
```

### Firestore Security Rules
```javascript
// New rules for group_memberships collection
match /group_memberships/{membershipId} {
  allow read: if request.auth != null && 
    request.auth.uid == resource.data.userId;
  allow write: if request.auth != null && 
    isGroupAdmin(resource.data.groupId);
}
```

## File-by-File Impact Analysis

### Core Service Changes

#### 1. `GroupMemberService.ts` 
**Status**: Major refactor required
- **New Constructor**: Add `IFirestoreWriter` dependency
- **Method Changes**:
  - `leaveGroup()`: Use `getMembershipDocument()` + `deleteMembershipFromTopLevel()`
  - `removeGroupMember()`: Same pattern as above
  - `getGroupMembersResponseFromSubcollection()`: **Renamed but compatible** - now reads from top-level
- **New Methods**:
  - `getMembership()`, `getMemberships()`: Top-level collection access
  - `deleteMembershipFromTopLevel()`: Remove from `group_memberships`

#### 2. `FirestoreReader.ts` 
**Status**: New methods required  
- **Add Methods**:
  - `getMembershipDocument(groupId, userId): GroupMembershipDocument | null`
  - `getMembershipDocuments(groupId): GroupMembershipDocument[]`
  - `getGroupsForUser(userId, options): PaginatedResult<GroupDocument>`

#### 3. `IFirestoreReader.ts`
**Status**: Interface expansion
- **Add Method Signatures**: For all new membership document methods
- **Type Updates**: Import `GroupMembershipDocument` type

#### 4. `IFirestoreWriter.ts`
**Status**: New write methods required
- **Add Methods**: 
  - `removeGroupMember(groupId, userId): Promise<void>`
  - `updateGroup(groupId, updates): Promise<void>`

### Schema Changes

#### 5. `schemas/group.ts`
**Status**: New schema definitions
- **Added**: `GroupMembershipDocumentSchema` with validation
- **Added**: `ParsedGroupMembershipDocument` type
- **Enhanced**: `UserThemeColorSchema` for theme validation

#### 6. `schemas/index.ts` 
**Status**: Export updates
- **Added**: Export `GroupMembershipDocumentSchema` and related types
- **Maintains**: Backward compatibility for existing exports

### Test Infrastructure

#### 7. `MockFirestoreReader.ts`
**Status**: Mock method additions
- **Add Mocks**: `getMembershipDocument`, `getMembershipDocuments`, `getGroupsForUser`
- **Update**: Existing mocks to handle new call patterns

#### 8. Test Files (Multiple)
**Status**: Comprehensive test updates
- **`GroupMemberService.test.ts`**: Use `GroupMembershipDocumentBuilder`
- **Integration Tests**: Update to use top-level collection patterns
- **Unit Tests**: Mock new dependencies (`IFirestoreWriter`)

### Test Support

#### 9. `GroupMembershipDocumentBuilder.ts` (New)
**Status**: New test utility
- **Purpose**: Builder pattern for creating test membership documents
- **Features**: Fluent API for role, status, theme configuration
- **Integration**: Works with existing theme assignment logic

### Shared Types

#### 10. `shared-types.ts`
**Status**: Constants update
- **Added**: `GROUP_MEMBERSHIPS: 'group_memberships'` constant
- **Enhanced**: Type safety for collection names

## Migration Implementation Strategy

### Phase 1: Foundation Setup
1. **Schema Definitions**: Complete `GroupMembershipDocumentSchema`
2. **Interface Updates**: Add methods to `IFirestoreReader`/`IFirestoreWriter`
3. **Database Indexes**: Deploy required Firestore indexes
4. **Test Infrastructure**: Complete `GroupMembershipDocumentBuilder`

### Phase 2: Service Layer Updates  
1. **FirestoreReader**: Implement membership document methods
2. **FirestoreWriter**: Implement remove/update methods
3. **GroupMemberService**: Add constructor dependency, update methods
4. **Service Registration**: Update DI to inject `IFirestoreWriter`

### Phase 3: Method Migration
1. **Update Methods**: Migrate internal calls from subcollection to top-level
2. **Maintain Compatibility**: Keep method names/signatures where possible
3. **Error Handling**: Enhanced error handling for balance checks

### Phase 4: Testing & Validation
1. **Unit Tests**: Update all service tests
2. **Integration Tests**: Verify end-to-end functionality  
3. **Mock Updates**: Complete mock implementations
4. **Performance Testing**: Validate query performance improvements

## Backward Compatibility Strategy

### Method Name Preservation
- `getGroupMembersResponseFromSubcollection()` **renamed but maintains signature**
- Internal implementation switches to top-level collection
- **Zero breaking changes** to calling code

### Dual-Write Pattern (Optional)
If gradual migration needed:
1. Write to both subcollection and top-level initially
2. Migrate reads to top-level collection
3. Remove subcollection writes in final phase

## Key Benefits of Migration

### 1. **Scalability Improvements**
- Direct collection queries vs collectionGroup limitations
- Efficient pagination for user groups
- Reduced database round-trips

### 2. **Performance Gains** 
- Single query for user groups with metadata
- Indexed sorting by `groupUpdatedAt`
- Optimized membership lookups

### 3. **Query Capabilities**
- User groups sorted by recent activity
- Efficient group member filtering
- Better support for complex membership queries

### 4. **Maintainability**
- Clearer data relationships
- Simplified service patterns
- Enhanced test coverage

## Risk Assessment

### Low Risk
- **Method signature compatibility**: Existing API contracts maintained
- **Schema validation**: Zod schemas prevent data corruption
- **Test coverage**: Comprehensive test updates included

### Medium Risk  
- **Data consistency**: Denormalized fields need maintenance (groupName, groupUpdatedAt)
- **Migration complexity**: Multiple services need coordinated updates
- **Performance impact**: Database index creation during migration

### Mitigation Strategies
1. **Validation**: Comprehensive schema validation prevents invalid data
2. **Testing**: Extensive unit and integration test coverage
3. **Rollback Plan**: Keep subcollection methods available during migration
4. **Monitoring**: Track query performance before/after migration

## Success Metrics

### Performance Improvements
- [ ] User group queries < 200ms (vs current ~500ms)
- [ ] Group member listings < 100ms
- [ ] Reduced database read operations by 40%

### Functionality Verification  
- [ ] All existing member operations work unchanged
- [ ] New pagination features work correctly
- [ ] Group sorting by recent activity functions
- [ ] Balance validation prevents invalid operations

### Code Quality
- [ ] 100% test coverage maintained
- [ ] TypeScript compilation with zero errors
- [ ] All linting rules pass
- [ ] Documentation updated

## Implementation Checklist

- [ ] **Phase 1**: Foundation Setup
  - [ ] Deploy Firestore indexes
  - [ ] Complete schema definitions
  - [ ] Update interface definitions
  - [ ] Create test builders

- [ ] **Phase 2**: Service Layer 
  - [ ] Implement FirestoreReader methods
  - [ ] Implement FirestoreWriter methods
  - [ ] Update GroupMemberService constructor
  - [ ] Update service registration

- [ ] **Phase 3**: Method Migration
  - [ ] Migrate `leaveGroup()` implementation
  - [ ] Migrate `removeGroupMember()` implementation  
  - [ ] Update `getGroupMembersResponseFromSubcollection()`
  - [ ] Add new membership methods

- [ ] **Phase 4**: Testing & Validation
  - [ ] Update all unit tests
  - [ ] Update all integration tests
  - [ ] Performance testing
  - [ ] End-to-end validation

---

**Next Steps**: Begin implementation with Phase 1 - Foundation Setup