# Feature: Archive Groups (User-Specific View Control)

## Status: READY FOR IMPLEMENTATION

**Last Updated:** January 2025
**Priority:** Medium
**Complexity:** Low-Medium

---

## 1. Overview

Users need a way to hide inactive groups from their dashboard without permanently leaving or deleting them. This feature provides user-specific group archiving that preserves all data and membership while decluttering the UI.

### Problem Statement

- Users accumulate groups over time (completed trips, old projects, inactive shared expenses)
- No non-destructive way to hide groups from the dashboard
- Leaving a group causes loss of historical data access
- Deleting a group is permanent and affects all members

### Solution

Extend the existing `MemberStatuses` enum to include an `ARCHIVED` status, allowing each user to control their own view of group visibility without affecting other members.

---

## 2. Current State Analysis

### Existing Infrastructure (✅ Already Implemented)

The codebase already has most of the necessary infrastructure:

1. **`MemberStatuses` enum** in `packages/shared/src/shared-types.ts`:
   ```typescript
   export const MemberStatuses = {
       ACTIVE: 'active',
       PENDING: 'pending',
   } as const;
   ```

2. **`memberStatus` field** on `GroupMembershipDTO` (lines 457, 502, 803 of shared-types.ts):
   ```typescript
   interface GroupMembershipDTO {
       memberStatus: MemberStatus;
       // ... other fields
   }
   ```

3. **Top-level `group-memberships` collection** - Used by `getGroupsForUserV2()` for efficient querying (firebase/functions/src/services/firestore/FirestoreReader.ts:431-505)

4. **Database-level ordering** - `getGroupsForUserV2()` already queries by `groupUpdatedAt` with proper pagination

### What's Missing

1. `ARCHIVED` status value in `MemberStatuses` enum
2. API endpoints for archiving/unarchiving
3. Query filtering logic in `getGroupsForUserV2()` to handle status filtering
4. Frontend UI controls and views
5. Zod schema updates for API validation

---

## 3. Technical Implementation Plan

### Phase 1: Backend Schema & Types

**Files to modify:**
- `packages/shared/src/shared-types.ts`
- `packages/shared/src/schemas/apiSchemas.ts`

**Changes:**

1. **Add ARCHIVED status to enum:**
   ```typescript
   export const MemberStatuses = {
       ACTIVE: 'active',
       PENDING: 'pending',
       ARCHIVED: 'archived',  // NEW
   } as const;
   ```

2. **Update API schemas** (apiSchemas.ts lines 175, 201, 277):
   ```typescript
   // Update existing schemas to include 'archived'
   memberStatus: z.enum(['active', 'pending', 'archived'])
   ```

3. **Add query filter type:**
   ```typescript
   export interface GetGroupsForUserOptions {
       limit?: number;
       cursor?: string;
       orderBy?: OrderBy;
       statusFilter?: MemberStatus | MemberStatus[];  // NEW
   }
   ```

### Phase 2: Backend Data Access Layer

**Files to modify:**
- `firebase/functions/src/services/firestore/IFirestoreReader.ts`
- `firebase/functions/src/services/firestore/FirestoreReader.ts`

**Changes:**

1. **Update `IFirestoreReader` interface** (line 136):
   ```typescript
   getGroupsForUserV2(
       userId: string,
       options?: GetGroupsForUserOptions  // Now includes statusFilter
   ): Promise<PaginatedResult<GroupDTO[]>>;
   ```

2. **Update `getGroupsForUserV2()` implementation** (FirestoreReader.ts:431-505):
   ```typescript
   async getGroupsForUserV2(userId: string, options?: GetGroupsForUserOptions): Promise<PaginatedResult<GroupDTO[]>> {
       return measureDb('USER_GROUPS_V2', async () => {
           const limit = options?.limit || 10;
           const orderDirection = options?.orderBy?.direction || 'desc';

           // Build base query
           let query = this.db
               .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
               .where('uid', '==', userId);

           // Apply status filtering
           if (options?.statusFilter) {
               if (Array.isArray(options.statusFilter)) {
                   query = query.where('memberStatus', 'in', options.statusFilter);
               } else {
                   query = query.where('memberStatus', '==', options.statusFilter);
               }
           } else {
               // Default: only show ACTIVE groups (exclude ARCHIVED and PENDING)
               query = query.where('memberStatus', '==', MemberStatuses.ACTIVE);
           }

           query = query.orderBy('groupUpdatedAt', orderDirection);

           // ... rest of pagination logic remains the same
       });
   }
   ```

3. **Update count query** (same method, line 444):
   ```typescript
   // Build count query matching the data query filters
   let countQuery = this.db
       .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
       .where('uid', '==', userId);

   if (options?.statusFilter) {
       if (Array.isArray(options.statusFilter)) {
           countQuery = countQuery.where('memberStatus', 'in', options.statusFilter);
       } else {
           countQuery = countQuery.where('memberStatus', '==', options.statusFilter);
       }
   } else {
       countQuery = countQuery.where('memberStatus', '==', MemberStatuses.ACTIVE);
   }
   ```

### Phase 3: Backend Service Layer

**Files to modify:**
- `firebase/functions/src/services/GroupMemberService.ts`
- `firebase/functions/src/services/GroupService.ts`

**Changes:**

1. **Add methods to `GroupMemberService`:**
   ```typescript
   async archiveGroupForUser(groupId: GroupId, userId: string): Promise<MessageResponse> {
       const member = await this.firestoreReader.getGroupMember(groupId, userId);

       if (!member) {
           throw Errors.NOT_FOUND('Group membership');
       }

       if (member.memberStatus !== MemberStatuses.ACTIVE) {
           throw Errors.INVALID_INPUT({
               message: 'Can only archive active group memberships'
           });
       }

       const now = new Date().toISOString();
       const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);

       await this.firestoreWriter.update(
           `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`,
           {
               memberStatus: MemberStatuses.ARCHIVED,
               updatedAt: now,
           }
       );

       logger.info('group-archived-for-user', { groupId, userId });
       return { message: 'Group archived successfully' };
   }

   async unarchiveGroupForUser(groupId: GroupId, userId: string): Promise<MessageResponse> {
       const member = await this.firestoreReader.getGroupMember(groupId, userId);

       if (!member) {
           throw Errors.NOT_FOUND('Group membership');
       }

       if (member.memberStatus !== MemberStatuses.ARCHIVED) {
           throw Errors.INVALID_INPUT({
               message: 'Can only unarchive archived group memberships'
           });
       }

       const now = new Date().toISOString();
       const topLevelDocId = getTopLevelMembershipDocId(userId, groupId);

       await this.firestoreWriter.update(
           `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`,
           {
               memberStatus: MemberStatuses.ACTIVE,
               updatedAt: now,
           }
       );

       logger.info('group-unarchived-for-user', { groupId, userId });
       return { message: 'Group unarchived successfully' };
   }
   ```

2. **Update `GroupService.listGroups()`** (firebase/functions/src/services/GroupService.ts:230-291):
   ```typescript
   async listGroups(userId: string, options: GetGroupsForUserOptions = {}): Promise<ListGroupsResponse> {
       return measure.measureDb('list-groups', async () => {
           // Pass statusFilter through to FirestoreReader
           // If not specified, FirestoreReader defaults to ACTIVE only
           return this._executeListGroups(userId, options);
       });
   }
   ```

### Phase 4: Backend API Routes

**Files to modify:**
- `firebase/functions/src/groups/GroupMemberHandlers.ts` (new handlers)
- `firebase/functions/src/index.ts` (register routes)

**Changes:**

1. **Add handler functions** (GroupMemberHandlers.ts):
   ```typescript
   export const archiveGroupForUserHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
       const groupId = req.params.groupId as GroupId;
       const userId = req.uid!;

       const result = await groupMemberService.archiveGroupForUser(groupId, userId);
       res.status(HTTP_STATUS.OK).json(result);
   });

   export const unarchiveGroupForUserHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
       const groupId = req.params.groupId as GroupId;
       const userId = req.uid!;

       const result = await groupMemberService.unarchiveGroupForUser(groupId, userId);
       res.status(HTTP_STATUS.OK).json(result);
   });
   ```

2. **Register routes** (index.ts):
   ```typescript
   app.post('/api/groups/:groupId/archive',
       authMiddleware,
       archiveGroupForUserHandler
   );

   app.post('/api/groups/:groupId/unarchive',
       authMiddleware,
       unarchiveGroupForUserHandler
   );
   ```

### Phase 5: Frontend API Client

**Files to modify:**
- `webapp-v2/src/api/apiClient.ts`

**Changes:**

1. **Add API methods:**
   ```typescript
   async archiveGroup(groupId: GroupId): Promise<MessageResponse> {
       return this.post(`/groups/${groupId}/archive`, {});
   }

   async unarchiveGroup(groupId: GroupId): Promise<MessageResponse> {
       return this.post(`/groups/${groupId}/unarchive`, {});
   }

   async listGroups(options?: {
       statusFilter?: MemberStatus | MemberStatus[];
       cursor?: string;
       limit?: number;
   }): Promise<ListGroupsResponse> {
       const params = new URLSearchParams();
       if (options?.statusFilter) {
           if (Array.isArray(options.statusFilter)) {
               params.append('statusFilter', options.statusFilter.join(','));
           } else {
               params.append('statusFilter', options.statusFilter);
           }
       }
       if (options?.cursor) params.append('cursor', options.cursor);
       if (options?.limit) params.append('limit', options.limit.toString());

       return this.get(`/groups?${params.toString()}`);
   }
   ```

### Phase 6: Frontend Store Updates

**Files to modify:**
- `webapp-v2/src/app/stores/groups-store-enhanced.ts`

**Changes:**

1. **Add archive state and methods:**
   ```typescript
   class GroupsStoreImpl implements GroupsStore {
       #showArchivedSignal = signal<boolean>(false);

       get showArchived(): ReadonlySignal<boolean> {
           return this.#showArchivedSignal;
       }

       async archiveGroup(groupId: GroupId): Promise<void> {
           this.#loadingSignal.value = true;
           try {
               await apiClient.archiveGroup(groupId);

               // Optimistic update: remove from active list
               this.#groupsSignal.value = this.#groupsSignal.value.filter(
                   g => g.id !== groupId
               );

               await this.fetchGroups(); // Refresh to ensure consistency
           } catch (error) {
               this.#errorSignal.value = this.getErrorMessage(error);
               throw error;
           } finally {
               this.#loadingSignal.value = false;
           }
       }

       async unarchiveGroup(groupId: GroupId): Promise<void> {
           this.#loadingSignal.value = true;
           try {
               await apiClient.unarchiveGroup(groupId);

               // Optimistic update: remove from archived list
               this.#groupsSignal.value = this.#groupsSignal.value.filter(
                   g => g.id !== groupId
               );

               await this.fetchGroups(); // Refresh to ensure consistency
           } catch (error) {
               this.#errorSignal.value = this.getErrorMessage(error);
               throw error;
           } finally {
               this.#loadingSignal.value = false;
           }
       }

       toggleShowArchived(): void {
           this.#showArchivedSignal.value = !this.#showArchivedSignal.value;
           this.fetchGroups(); // Refresh with new filter
       }

       async fetchGroups(): Promise<void> {
           const statusFilter = this.#showArchivedSignal.value
               ? MemberStatuses.ARCHIVED
               : MemberStatuses.ACTIVE;

           const response = await apiClient.listGroups({ statusFilter });
           this.#groupsSignal.value = response.groups;
       }
   }
   ```

### Phase 7: Frontend UI Components

**Files to modify:**
- `webapp-v2/src/pages/DashboardPage.tsx`
- `webapp-v2/src/components/GroupCard.tsx` (add archive button)

**Changes:**

1. **Add filter toggle in DashboardPage:**
   ```typescript
   <div className="flex justify-between items-center mb-4">
       <h1 className="text-2xl font-bold">
           {groupsStore.showArchived ? 'Archived Groups' : 'My Groups'}
       </h1>
       <button
           onClick={() => groupsStore.toggleShowArchived()}
           className="text-sm text-blue-600 hover:text-blue-800"
       >
           {groupsStore.showArchived ? 'Show Active Groups' : 'Show Archived Groups'}
       </button>
   </div>
   ```

2. **Add archive/unarchive action in GroupCard:**
   ```typescript
   <button
       onClick={() => handleArchiveToggle(group.id)}
       className="text-sm text-gray-600 hover:text-gray-900"
       data-testid={`${showArchived ? 'unarchive' : 'archive'}-group-${group.id}`}
   >
       {showArchived ? '↩️ Unarchive' : '📦 Archive'}
   </button>
   ```

---

## 4. Testing Strategy

### Unit Tests

1. **Backend Service Tests** (`GroupMemberService.test.ts`):
   - Archive active group membership
   - Unarchive archived group membership
   - Reject archiving non-active memberships
   - Reject unarchiving non-archived memberships
   - Verify proper error handling

2. **FirestoreReader Tests** (`firestore-reader.test.ts`):
   - Query filtering with `statusFilter: 'active'`
   - Query filtering with `statusFilter: 'archived'`
   - Query filtering with `statusFilter: ['active', 'pending']` (array)
   - Default behavior (no filter = active only)

### Integration Tests

1. **API Integration Tests** (new file: `group-archiving.integration.test.ts`):
   - Archive group via API
   - Unarchive group via API
   - List groups with different status filters
   - Verify archived groups don't appear in default listing
   - Verify archived groups appear when explicitly requested

### E2E Tests

1. **Dashboard Tests** (`dashboard.e2e.test.ts`):
   - Archive group from dashboard
   - Verify group disappears from active list
   - Toggle to archived view
   - Verify group appears in archived list
   - Unarchive group
   - Verify group reappears in active list

---

## 5. Database Indexes Required

**Composite index needed for `group-memberships` collection:**

```json
{
  "collectionGroup": "group-memberships",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "uid", "order": "ASCENDING" },
    { "fieldPath": "memberStatus", "order": "ASCENDING" },
    { "fieldPath": "groupUpdatedAt", "order": "DESCENDING" }
  ]
}
```

This index supports:
- Filtering by user ID (`uid`)
- Filtering by member status (`memberStatus`)
- Ordering by group activity (`groupUpdatedAt`)

**Note:** Firebase will automatically suggest creating this index when the query is first executed. The error message will include the exact index configuration needed.

---

## 6. Migration Considerations

### Existing Data

**No migration required** - all existing `memberStatus` values are already `'active'` or `'pending'`, which remain valid.

### Backward Compatibility

- New `ARCHIVED` status is additive, not breaking
- Existing queries without `statusFilter` get new default behavior (active only)
- Frontend gracefully handles missing status fields (defaults to active)

---

## 7. Implementation Checklist

**Phase 1: Backend Schema**
- [ ] Add `ARCHIVED` to `MemberStatuses` enum
- [ ] Update Zod schemas in `apiSchemas.ts`
- [ ] Add `statusFilter` to `GetGroupsForUserOptions`
- [ ] Run `npm run build` to verify types

**Phase 2: Data Access**
- [ ] Update `IFirestoreReader` interface
- [ ] Implement status filtering in `getGroupsForUserV2()`
- [ ] Update count query to match filter logic
- [ ] Add unit tests for query filtering

**Phase 3: Service Layer**
- [ ] Add `archiveGroupForUser()` to `GroupMemberService`
- [ ] Add `unarchiveGroupForUser()` to `GroupMemberService`
- [ ] Add unit tests for both methods
- [ ] Update `GroupService.listGroups()` to pass statusFilter

**Phase 4: API Routes**
- [ ] Add handler functions in `GroupMemberHandlers.ts`
- [ ] Register routes in `index.ts`
- [ ] Add integration tests for new endpoints
- [ ] Test with Postman/curl

**Phase 5: Frontend API Client**
- [ ] Add `archiveGroup()` method
- [ ] Add `unarchiveGroup()` method
- [ ] Update `listGroups()` to support statusFilter
- [ ] Add error handling

**Phase 6: Frontend Store**
- [ ] Add `showArchived` state
- [ ] Add `archiveGroup()` method
- [ ] Add `unarchiveGroup()` method
- [ ] Add `toggleShowArchived()` method
- [ ] Update `fetchGroups()` to use statusFilter

**Phase 7: Frontend UI**
- [ ] Add archive/unarchive button to GroupCard
- [ ] Add archived/active toggle in DashboardPage
- [ ] Add loading/error states
- [ ] Add success feedback (toast/notification)

**Testing**
- [ ] Write unit tests (backend)
- [ ] Write integration tests (API)
- [ ] Write e2e tests (UI workflows)
- [ ] Manual testing of all scenarios

**Database**
- [ ] Create composite index (done automatically on first query)
- [ ] Verify query performance

---

## 8. Key Design Decisions

### ✅ Why extend MemberStatuses instead of adding a new field?

**Decision:** Use existing `memberStatus` field with new `ARCHIVED` value

**Rationale:**
- Aligns with existing architecture (PENDING status already exists)
- Single field represents membership state (active/pending/archived)
- Cleaner queries (one field to filter on)
- Simpler schema (no additional nullable fields)

**Alternative considered:** Add separate `isArchived: boolean` field
- **Rejected:** Creates ambiguity (what if `isArchived=true` and `memberStatus=pending`?)

### ✅ Why default to ACTIVE-only when no filter specified?

**Decision:** `getGroupsForUserV2()` defaults to `memberStatus == 'active'` when no filter provided

**Rationale:**
- Expected user behavior (see active groups by default)
- Backward compatible with current behavior
- Explicit opt-in required to see archived groups
- Reduces dashboard clutter

**Alternative considered:** Return all statuses by default
- **Rejected:** Would show archived groups unexpectedly

### ✅ Why not soft-delete the group for the user?

**Decision:** Archive is a view preference, not deletion

**Rationale:**
- User remains a member (can be @mentioned, sees notifications)
- Group data remains accessible if directly linked
- Can unarchive at any time
- Clear semantic difference from "leaving" a group

---

## 9. Future Enhancements

### Not in Scope (v1)

1. **Bulk Archive/Unarchive** - Archive multiple groups at once
2. **Auto-Archive Rules** - Auto-archive groups inactive for X days
3. **Archive Notifications** - Notify user when group is archived
4. **Archive Analytics** - Track which groups users archive most

### Potential v2 Features

1. **Group-level archive** - Admin can archive entire group for all members (distinct from deletion)
2. **Archive reasons** - User can optionally provide reason for archiving
3. **Archive history** - Track when/why groups were archived

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Composite index creation fails | Query errors | Test in staging first; manual index creation if needed |
| Users confused about archived vs deleted | Support tickets | Clear UI labels; tooltips explaining difference |
| Performance impact on queries | Slow dashboard load | Monitor query metrics; optimize if needed |
| Accidental archive | User frustration | Easy unarchive option; confirmation dialog (optional) |

---

## 11. Success Metrics

- [ ] Zero errors when querying with `statusFilter`
- [ ] Archive/unarchive operations complete in <500ms
- [ ] E2E tests pass with 100% success rate
- [ ] Dashboard load time unchanged (< 2s)
- [ ] User can archive and unarchive groups within 2 clicks

---

## References

- MemberStatuses enum: `packages/shared/src/shared-types.ts:156-161`
- GroupMembershipDTO: `packages/shared/src/shared-types.ts:457, 502, 803`
- getGroupsForUserV2: `firebase/functions/src/services/firestore/FirestoreReader.ts:431-505`
- GroupService.listGroups: `firebase/functions/src/services/GroupService.ts:230-291`
- GroupMemberService: `firebase/functions/src/services/GroupMemberService.ts`
