# Real-time Notification System Bugs

**Detected by:** Integration test `realtime-notifications.integration.test.ts`  
**Date:** 2025-01-10  
**Severity:** High - Affects user experience and real-time synchronization

## 🐛 Critical Bugs Identified

### Bug #1: Missing Transaction Notifications for Shared Expense Participants

**Description:** When User A creates a shared expense involving User B, User B does not receive transaction/balance change notifications.

**Evidence from Tests:**
```
User 1 events for group zwsXdQCw: [
  { type: 'transaction', version: 54, transactionCount: 2 },
  { type: 'balance', version: 55, transactionCount: 2 }
]
User 2 events for group zwsXdQCw: [
  { type: 'group', version: 1, transactionCount: undefined },
  { type: 'group', version: 2, transactionCount: undefined }
]
```

**Impact:** 
- Users don't see real-time updates for expenses they participate in
- UI becomes inconsistent between users
- Users may miss important financial changes

**Expected Behavior:** Both users should receive transaction and balance change notifications when a shared expense is created.

---

### Bug #2: Inconsistent Notification Document Creation

**Description:** Notification documents are not consistently created when users create groups.

**Evidence from Tests:**
```
AssertionError: expected undefined to be defined
❯ expect(notification!.groups[group.id]).toBeDefined();
```

**Impact:**
- Some users may not receive any notifications
- Intermittent real-time update failures
- Unreliable notification system

**Expected Behavior:** Every group creation should create/update the user's notification document.

---

### Bug #3: Notification Version Inconsistency Between Users

**Description:** Different users have dramatically different notification versions for the same system state.

**Evidence from Tests:**
```
User 1: version: 55, groupCount: 15
User 2: version: 4, groupCount: 1
```

**Impact:**
- Users may be out of sync with the system state
- Potential race conditions
- Inconsistent real-time updates

**Expected Behavior:** Notification versions should be consistent or at least coherent across users.

---

### Bug #4: Cross-User Group Visibility

**Description:** User 1 receives notifications for 15 groups while User 2 sees only 1 group, suggesting potential data leakage or isolation issues.

**Evidence from Tests:**
```
User 1: groupIds: [15 different group IDs]
User 2: groupIds: [1 group ID]
```

**Impact:**
- Privacy concerns - users seeing other users' groups
- Performance issues - unnecessary notifications
- Potential security vulnerability

**Expected Behavior:** Users should only receive notifications for groups they are members of.

---

## 🧪 Test Cases That Reproduce Bugs

### Reproduction Steps:
1. Run: `npx vitest run src/__tests__/integration/realtime-notifications.integration.test.ts`
2. Observe the failing tests:
   - "should create notification document when user creates first group"
   - "should notify both users when user1 creates group, user2 joins, and user1 creates shared expense"

### Specific Test Case:
```typescript
test('should notify both users when user1 creates group, user2 joins, and user1 creates shared expense', async () => {
  // Creates group with User 1
  // User 2 joins via share link  
  // User 1 creates shared expense with both users
  // FAILS: User 2 doesn't receive transaction notifications
});
```

## 🔧 Suggested Investigation Areas

### 1. User Notification Document Creation
- Check the trigger functions that create `user-notifications/{userId}` documents
- Ensure they fire for all group creation scenarios
- Verify atomic operations and error handling

### 2. Shared Expense Notification Logic
- Review the backend logic that determines which users get notified for shared expenses
- Check if participant lists are properly processed
- Verify notification document updates for all affected users

### 3. Notification Versioning System
- Review the global vs per-user versioning strategy
- Check for race conditions in version incrementing
- Ensure consistent state across user notification documents

### 4. Group Membership Isolation
- Audit group membership checks in notification triggers
- Ensure users only receive notifications for their groups
- Review security rules and data access patterns

## 🎯 Business Impact

**User Experience Issues:**
- Users miss real-time updates for shared expenses
- Inconsistent app state between users
- Poor collaboration experience

**Technical Debt:**
- Unreliable notification system
- Potential data consistency issues
- Security/privacy concerns

## 📋 Acceptance Criteria for Fixes

1. **User 2 receives transaction notifications** when participating in shared expenses
2. **Notification documents are created consistently** for all users who create/join groups  
3. **Users only see notifications for their own groups**
4. **All integration tests pass** without timeouts or missing data
5. **Real-time updates work reliably** for multi-user scenarios

## 🔍 Next Steps

1. **Investigate backend notification triggers** - Check Cloud Functions that create user notification documents
2. **Review shared expense logic** - Ensure all participants are properly notified
3. **Audit group membership rules** - Fix cross-user data visibility issues
4. **Run integration tests regularly** - Use the comprehensive test suite to validate fixes

---

**Files to examine:**
- Backend notification trigger functions
- Shared expense creation logic  
- User notification document structure
- Group membership validation code

**Test file:** `firebase/functions/src/__tests__/integration/realtime-notifications.integration.test.ts`