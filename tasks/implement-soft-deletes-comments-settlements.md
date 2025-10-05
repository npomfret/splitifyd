# Feature: Implement Soft Deletes for Comments and Settlements

## 1. Overview

Currently, only `ExpenseDTO` supports soft deletion with `deletedAt` and `deletedBy` fields. Comments and Settlements use hard deletion, which permanently removes data from Firestore and makes it impossible to recover accidentally deleted items or audit deletion history.

This feature will:
1. Extend soft delete support to `CommentDTO` and `SettlementDTO`
2. Standardize soft delete metadata fields across all entities (Expenses, Comments, Settlements)
3. Establish a common `SoftDeletable` interface to ensure consistency
4. Update all related services, schemas, and API endpoints to respect soft delete state

## 2. The Problem: Inconsistent Deletion Behavior

### 2.1. Current State

- **Expenses**: Support soft deletion (`deletedAt: ISOString | null`, `deletedBy: string | null`)
- **Comments**: Hard deletion only (data permanently removed from Firestore)
- **Settlements**: Hard deletion only (data permanently removed from Firestore)
- **Groups**: Hard deletion only (no soft delete support planned)

### 2.2. Issues with Current Approach

1. **Data Loss**: Accidental comment or settlement deletions cannot be recovered
2. **No Audit Trail**: Cannot track who deleted a comment or settlement, or when
3. **Inconsistent API Behavior**: Deletion endpoints behave differently across entity types
4. **Missing Metadata**: Expenses have `deletedBy` but it's not standardized across entities
5. **Query Complexity**: No standard way to filter out soft-deleted items across different entity types

### 2.3. Real-World Scenarios

- **Accidental Deletion**: User accidentally deletes an important comment explaining an expense split
- **Audit Requirements**: Group admin needs to see who deleted a settlement and when
- **Undelete Functionality**: User wants to restore a recently deleted comment (future feature)
- **Data Retention**: Compliance requirements mandate keeping deleted records for a specified period

## 3. The Solution: Standardized Soft Delete Pattern

### 3.1. Common Soft Delete Interface

Create a shared interface that all soft-deletable entities implement:

```typescript
// In packages/shared/src/shared-types.ts

/**
 * Common soft delete metadata fields.
 * All soft-deletable entities must include these fields.
 */
export interface SoftDeletable {
    /**
     * ISO 8601 timestamp when the entity was soft-deleted.
     * null indicates the entity is active (not deleted).
     */
    deletedAt: ISOString | null;

    /**
     * UID of the user who deleted the entity.
     * null indicates the entity is active (not deleted).
     */
    deletedBy: string | null;
}

// Update constant for consistency
export const SOFT_DELETE_FIELDS = {
    DELETED_AT: 'deletedAt',
    DELETED_BY: 'deletedBy',
} as const;

// Remove the old DELETED_AT_FIELD constant in favor of SOFT_DELETE_FIELDS
```

### 3.2. Updated Type Definitions

#### Expense (Already Supports Soft Delete - No Changes to Fields)

```typescript
// Expense already has the correct fields
export interface Expense extends SoftDeletable {
    groupId: string;
    createdBy: string;
    paidBy: string;
    amount: number;
    currency: string;
    description: string;
    category: string;
    date: ISOString;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: string[];
    splits: ExpenseSplit[];
    receiptUrl?: string;
    // Inherited from SoftDeletable:
    // deletedAt: ISOString | null;
    // deletedBy: string | null;
}
```

#### Comment (NEW: Add Soft Delete Support)

```typescript
// Before
export interface Comment {
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    text: string;
}

// After
export interface Comment extends SoftDeletable {
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    text: string;
    // Inherited from SoftDeletable:
    // deletedAt: ISOString | null;
    // deletedBy: string | null;
}
```

#### Settlement (NEW: Add Soft Delete Support)

```typescript
// Before
export interface Settlement {
    groupId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    currency: string;
    date: ISOString;
    note?: string;
    createdBy: string;
}

// After
export interface Settlement extends SoftDeletable {
    groupId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    currency: string;
    date: ISOString;
    note?: string;
    createdBy: string;
    // Inherited from SoftDeletable:
    // deletedAt: ISOString | null;
    // deletedBy: string | null;
}
```

### 3.3. Schema Updates

Update Firestore Document schemas to validate the new soft delete fields:

#### Comment Schema
```typescript
// firebase/functions/src/schemas/comment.ts

export const CommentDocumentSchema = z.object({
    authorId: z.string().min(1),
    authorName: z.string().min(1),
    authorAvatar: z.string().url().optional(),
    text: z.string().min(1).max(5000),

    // NEW: Soft delete fields
    deletedAt: TimestampSchema.nullable(),
    deletedBy: z.string().min(1).nullable(),

    // Metadata
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});
```

#### Settlement Schema
```typescript
// firebase/functions/src/schemas/settlement.ts

export const SettlementDocumentSchema = z.object({
    groupId: z.string().min(1),
    payerId: z.string().min(1),
    payeeId: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().length(3),
    date: TimestampSchema,
    note: z.string().max(500).optional(),
    createdBy: z.string().min(1),

    // NEW: Soft delete fields
    deletedAt: TimestampSchema.nullable(),
    deletedBy: z.string().min(1).nullable(),

    // Metadata
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});
```

## 4. Implementation Plan

### Phase 1: Foundation - Schema and Type Updates

#### Task 1.1: Update Shared Types
- [ ] Create `SoftDeletable` interface in `packages/shared/src/shared-types.ts`
- [ ] Create `SOFT_DELETE_FIELDS` constant (replace `DELETED_AT_FIELD`)
- [ ] Update `Comment` interface to extend `SoftDeletable`
- [ ] Update `Settlement` interface to extend `SoftDeletable`
- [ ] Update `Expense` interface to explicitly extend `SoftDeletable` (clarifies intent)
- [ ] Run type checks across all packages: `npm run build`

#### Task 1.2: Update Firestore Schemas
- [ ] Update `CommentDocumentSchema` in `firebase/functions/src/schemas/comment.ts`
  - Add `deletedAt: TimestampSchema.nullable()`
  - Add `deletedBy: z.string().min(1).nullable()`
- [ ] Update `SettlementDocumentSchema` in `firebase/functions/src/schemas/settlement.ts`
  - Add `deletedAt: TimestampSchema.nullable()`
  - Add `deletedBy: z.string().min(1).nullable()`
- [ ] Verify `ExpenseDocumentSchema` has proper schema validation for soft delete fields
- [ ] Run schema validation tests: `npm run test:unit`

### Phase 2: Service Layer Updates

#### Task 2.1: Update CommentService
- [ ] **Modify `createComment`**: Ensure new comments have `deletedAt: null` and `deletedBy: null`
- [ ] **Create `softDeleteComment`**: New method to mark comment as deleted
  ```typescript
  async softDeleteComment(
      commentId: string,
      userId: string,
      targetType: CommentTargetType,
      targetId: string
  ): Promise<void> {
      // Permission check: User must be comment author or group admin
      // Update: { deletedAt: new Date().toISOString(), deletedBy: userId }
  }
  ```
- [ ] **Update `listComments`**: Filter out soft-deleted comments by default
  - Add optional `includeDeleted` parameter for admin views
  - Firestore query: `.where('deletedAt', '==', null)`
- [ ] **Update `getComment`**: Return null if comment is soft-deleted (unless admin)
- [ ] Add unit tests for all soft delete scenarios

#### Task 2.2: Update SettlementService
- [ ] **Modify `createSettlement`**: Ensure new settlements have `deletedAt: null` and `deletedBy: null`
- [ ] **Create `softDeleteSettlement`**: New method to mark settlement as deleted
  ```typescript
  async softDeleteSettlement(
      settlementId: string,
      userId: string,
      groupId: string
  ): Promise<void> {
      // Permission check: User must be settlement creator or group admin
      // Update: { deletedAt: new Date().toISOString(), deletedBy: userId }
      // Trigger balance recalculation for the group
  }
  ```
- [ ] **Update `listSettlements`**: Filter out soft-deleted settlements by default
  - Firestore query: `.where('deletedAt', '==', null)`
- [ ] **Update `getSettlement`**: Return null if settlement is soft-deleted
- [ ] **Update balance calculations**: Ensure soft-deleted settlements are excluded
- [ ] Add unit tests for all soft delete scenarios

#### Task 2.3: Update ExpenseService (Consistency)
- [ ] **Verify `softDeleteExpense`**: Ensure it follows same pattern as new services
- [ ] **Standardize naming**: Rename to match new pattern if needed
- [ ] **Add integration tests**: Test soft delete across all three entity types

### Phase 3: API Endpoint Updates

#### Task 3.1: Comment Deletion Endpoints
- [ ] **Update `DELETE /api/comments/:id`**: Change from hard delete to soft delete
  - Call `commentService.softDeleteComment()` instead of hard delete
  - Return success response with deletion metadata
  - Update OpenAPI/Swagger documentation
- [ ] **Add permission checks**: Only comment author or group admin can delete
- [ ] **Update response type**:
  ```typescript
  export interface DeleteCommentResponse {
      success: boolean;
      message: string;
      deletedAt: ISOString;
      deletedBy: string;
  }
  ```
- [ ] Add integration tests for deletion endpoint

#### Task 3.2: Settlement Deletion Endpoints
- [ ] **Update `DELETE /api/settlements/:id`**: Change from hard delete to soft delete
  - Call `settlementService.softDeleteSettlement()` instead of hard delete
  - Trigger balance recalculation
  - Return success response with deletion metadata
  - Update OpenAPI/Swagger documentation
- [ ] **Add permission checks**: Only settlement creator or group admin can delete
- [ ] **Update response type**:
  ```typescript
  export interface DeleteSettlementResponse {
      success: boolean;
      message: string;
      deletedAt: ISOString;
      deletedBy: string;
  }
  ```
- [ ] Add integration tests for deletion endpoint and balance recalculation

#### Task 3.3: Update List Endpoints
- [ ] **Update `GET /api/groups/:groupId/comments`**: Exclude soft-deleted by default
- [ ] **Update `GET /api/groups/:groupId/settlements`**: Exclude soft-deleted by default
- [ ] **Update `GET /api/expenses`**: Verify soft-deleted expenses are excluded
- [ ] Add query parameter `?includeDeleted=true` for admin views (future feature)

### Phase 4: FirestoreReader/Writer Updates

#### Task 4.1: Update FirestoreReader
- [ ] **Add helper method `filterSoftDeleted`**: Reusable query filter
  ```typescript
  private filterSoftDeleted<T>(query: Query<T>): Query<T> {
      return query.where(SOFT_DELETE_FIELDS.DELETED_AT, '==', null);
  }
  ```
- [ ] **Update `getComments`**: Apply soft delete filter
- [ ] **Update `getSettlements`**: Apply soft delete filter
- [ ] **Verify `getExpenses`**: Ensure soft delete filter is applied
- [ ] Add unit tests with mocked Firestore data including soft-deleted items

#### Task 4.2: Update FirestoreWriter
- [ ] **Add helper method `setSoftDeleteMetadata`**: Reusable update helper
  ```typescript
  private createSoftDeleteMetadata(userId: string) {
      return {
          deletedAt: Timestamp.now(),
          deletedBy: userId,
      };
  }
  ```
- [ ] **Update `deleteComment`**: Use soft delete instead of hard delete
- [ ] **Update `deleteSettlement`**: Use soft delete instead of hard delete
- [ ] **Verify `deleteExpense`**: Ensure it uses soft delete pattern
- [ ] Add unit tests for soft delete writes

### Phase 5: Data Migration

#### Task 5.1: Existing Data Migration
- [ ] **Create migration script**: `firebase/scripts/migrate-soft-delete-fields.ts`
  ```typescript
  // Add deletedAt: null and deletedBy: null to all existing comments
  // Add deletedAt: null and deletedBy: null to all existing settlements
  // Verify all existing expenses have these fields (backfill if needed)
  ```
- [ ] **Test migration** on local emulator with production-like data
- [ ] **Create rollback script** in case of issues
- [ ] **Document migration process** in script comments
- [ ] **Run migration** on staging environment first
- [ ] **Run migration** on production (schedule downtime if needed)

### Phase 6: Testing

#### Task 6.1: Unit Tests
- [ ] CommentService soft delete tests
  - Test creating comment initializes soft delete fields to null
  - Test soft delete marks comment with correct metadata
  - Test list excludes soft-deleted comments
  - Test permissions for deletion
- [ ] SettlementService soft delete tests
  - Test creating settlement initializes soft delete fields to null
  - Test soft delete marks settlement with correct metadata
  - Test list excludes soft-deleted settlements
  - Test balance calculation excludes soft-deleted settlements
  - Test permissions for deletion
- [ ] ExpenseService consistency tests
  - Verify expense soft delete follows same pattern

#### Task 6.2: Integration Tests
- [ ] Test soft delete across all entity types in real Firebase emulator
- [ ] Test balance calculations with soft-deleted settlements
- [ ] Test comment threads with soft-deleted comments
- [ ] Test permission checks for deletion endpoints
- [ ] Test that soft-deleted items don't appear in list queries
- [ ] Test FirestoreReader/Writer conversions handle soft delete fields correctly

#### Task 6.3: E2E Tests (Future)
- [ ] Create E2E test for deleting and restoring a comment (when undelete is implemented)
- [ ] Create E2E test for deleting a settlement and verifying balance update
- [ ] Create E2E test for admin viewing deleted items

### Phase 7: Documentation

#### Task 7.1: Update API Documentation
- [ ] Document soft delete behavior in API docs
- [ ] Update DELETE endpoint documentation to specify soft delete
- [ ] Document permission requirements for deletion
- [ ] Add examples of deletion responses with metadata

#### Task 7.2: Update Architecture Docs
- [ ] Update `docs/guides/TYPES_GUIDELINES.md` with `SoftDeletable` interface
- [ ] Document soft delete pattern in code guidelines
- [ ] Add examples of proper soft delete usage
- [ ] Document data migration process

#### Task 7.3: Update Code Comments
- [ ] Add JSDoc comments to `SoftDeletable` interface
- [ ] Add comments to soft delete helper methods
- [ ] Document why Groups don't support soft deletion (if applicable)

## 5. Benefits of This Approach

### 5.1. Data Safety
- **No Data Loss**: Accidentally deleted items can be recovered (future undelete feature)
- **Audit Trail**: Complete history of who deleted what and when
- **Compliance**: Meets data retention requirements for regulated industries

### 5.2. Consistency
- **Standardized Interface**: All soft-deletable entities follow same pattern
- **Predictable Behavior**: Deletion works the same way across all entity types
- **Code Reusability**: Shared helper methods and utilities for soft delete operations

### 5.3. Future Features Enabled
- **Undelete Functionality**: Easy to implement "restore deleted item" feature
- **Admin Dashboard**: Show deleted items for moderation/audit purposes
- **Data Archiving**: Automated cleanup of old soft-deleted items after retention period
- **Analytics**: Track deletion patterns and reasons

### 5.4. Development Experience
- **Type Safety**: `SoftDeletable` interface enforces correct field usage
- **Clear Intent**: Explicit interface makes soft delete behavior obvious
- **Reduced Bugs**: Standardized pattern reduces chance of forgetting to filter deleted items

## 6. Migration Considerations

### 6.1. Backward Compatibility
- **Existing Comments**: Will have `deletedAt: null`, `deletedBy: null` added via migration script
- **Existing Settlements**: Will have `deletedAt: null`, `deletedBy: null` added via migration script
- **Existing Expenses**: Already have soft delete fields, verify consistency
- **API Clients**: No breaking changes - deletion endpoints still return success

### 6.2. Database Schema Evolution
- **Before Migration**: Comments and Settlements lack soft delete fields
- **After Migration**: All entities have `deletedAt` and `deletedBy` fields
- **Query Performance**: Add Firestore indexes on `deletedAt` field for list queries
- **Storage Impact**: Minimal (~16 bytes per document for two new fields)

### 6.3. Firestore Index Updates
```typescript
// Required composite indexes for efficient queries:
// Collection: comments
// Fields: deletedAt (Ascending), createdAt (Descending)

// Collection: settlements
// Fields: deletedAt (Ascending), date (Descending)

// Collection: expenses
// Fields: deletedAt (Ascending), date (Descending)
```

## 7. Security Considerations

### 7.1. Permission Checks
- **Comment Deletion**: Only comment author or group admin
- **Settlement Deletion**: Only settlement creator or group admin (must recalculate balances)
- **Expense Deletion**: Follow existing permission rules (already implemented)

### 7.2. Firestore Security Rules
Update security rules to validate soft delete fields:

```javascript
// For comments subcollection
match /groups/{groupId}/comments/{commentId} {
    allow delete: if false; // Never allow hard delete from client

    allow update: if request.auth != null
        && (
            // Only allow setting deletedAt and deletedBy
            request.resource.data.diff(resource.data).affectedKeys()
                .hasOnly(['deletedAt', 'deletedBy', 'updatedAt'])
            && (
                // Must be comment author or group admin
                resource.data.authorId == request.auth.uid
                || isGroupAdmin(groupId, request.auth.uid)
            )
            && request.resource.data.deletedBy == request.auth.uid
            && request.resource.data.deletedAt != null
        );
}
```

## 8. Future Enhancements

### 8.1. Undelete Functionality
- Add `POST /api/comments/:id/restore` endpoint
- Add `POST /api/settlements/:id/restore` endpoint
- UI: "Undo delete" notification for 30 seconds after deletion

### 8.2. Admin Dashboard
- View all deleted items across groups
- Bulk restore/permanently delete operations
- Export deleted items for compliance audits

### 8.3. Automated Cleanup
- Background job to permanently delete items older than X days
- Configurable retention policies per group or globally
- Notification before permanent deletion

### 8.4. Deletion Reasons
- Add optional `deletionReason: string` field
- Capture user-provided reason for deletion
- Analytics on most common deletion reasons

## 9. Success Metrics

### 9.1. Technical Metrics
- [ ] 100% of comments have soft delete fields after migration
- [ ] 100% of settlements have soft delete fields after migration
- [ ] Zero hard deletes in production logs after rollout
- [ ] All list queries exclude soft-deleted items by default
- [ ] Test coverage > 90% for soft delete functionality

### 9.2. User Impact Metrics
- [ ] Reduction in "accidental deletion" support tickets
- [ ] Time to restore accidentally deleted items (future: < 1 minute)
- [ ] User satisfaction with deletion/restoration flow

## 10. Rollout Plan

### 10.1. Phase 1: Deploy Schema Changes (Week 1)
- Deploy updated schemas to staging
- Run migration script on staging data
- Verify all existing items have soft delete fields
- Monitor for any data integrity issues

### 10.2. Phase 2: Deploy Service Changes (Week 2)
- Deploy updated services to staging
- Test all deletion flows manually
- Run full test suite
- Monitor logs for any unexpected behavior

### 10.3. Phase 3: Production Deployment (Week 3)
- Deploy schema changes to production
- Run migration script during low-traffic window
- Deploy service changes
- Monitor error rates and user feedback
- Have rollback plan ready

### 10.4. Phase 4: Enable Undelete (Week 4+)
- Implement undelete endpoints
- Add UI for restoring deleted items
- Beta test with selected users
- Full rollout after successful beta

## 11. Risks and Mitigations

### 11.1. Risk: Migration Script Failure
- **Impact**: Incomplete soft delete fields in production
- **Mitigation**: Test thoroughly on staging, have rollback script ready
- **Monitoring**: Track migration progress, alert on errors

### 11.2. Risk: Query Performance Degradation
- **Impact**: Slower list queries due to soft delete filter
- **Mitigation**: Add Firestore indexes, monitor query performance
- **Rollback**: Can remove filter temporarily if needed

### 11.3. Risk: Balance Calculation Errors
- **Impact**: Incorrect balances if soft-deleted settlements included
- **Mitigation**: Comprehensive testing, verify balance calculations exclude soft-deleted items
- **Monitoring**: Alert on balance calculation errors

### 11.4. Risk: Breaking API Changes
- **Impact**: Client apps break if deletion endpoint behavior changes unexpectedly
- **Mitigation**: Maintain same API contract, only internal behavior changes
- **Testing**: Full integration test suite before production deployment

## 12. Definition of Done

- [ ] All code merged to main branch
- [ ] All tests passing (unit, integration, E2E)
- [ ] Data migration completed successfully in production
- [ ] Documentation updated (API docs, architecture guides, code comments)
- [ ] Firestore indexes created for optimal query performance
- [ ] Security rules updated and tested
- [ ] Monitoring dashboards updated with soft delete metrics
- [ ] Team trained on new soft delete pattern
- [ ] No critical bugs in production for 1 week post-rollout
- [ ] Support tickets related to accidental deletions reduced by >50%
