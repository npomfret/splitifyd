# Remove User Denormalization from Firebase Functions

## Overview

This document outlines the plan to remove all denormalized user data from the Firebase functions codebase. Currently, user information (names, emails, display names) is stored redundantly in multiple places, causing synchronization issues and data inconsistencies.

## Problem Statement

### Current Issues
1. **"Unknown User" Problem**: Users joining groups via share links show as "Unknown User" because their displayName and email aren't properly stored in the group's member array
2. **Data Inconsistency**: User profile changes don't propagate to denormalized copies
3. **Complex Update Logic**: Multiple places need updating when user data changes
4. **Storage Overhead**: Redundant data storage increases Firestore costs
5. **Maintenance Burden**: More complex code to maintain data consistency

### Current Denormalization Patterns

#### 1. Groups Collection (`documents`)
```typescript
interface GroupDocument {
  memberIds: string[];        // ✓ Keep this for queries
  memberEmails: string[];     // ✗ Remove - redundant
  members: User[];            // ✗ Remove - redundant
}
```

#### 2. Group Members Storage
When users join via share link (`shareHandlers.ts`):
```typescript
const newMember = {
  uid: userId,
  name: userName,            // Inconsistent field name
  initials: '...',
  role: 'member',
  joinedAt: '...'
  // Missing: displayName, email
};
```

#### 3. Balance Calculations
User names are embedded in balance objects:
```typescript
interface UserBalance {
  userId: string;
  name: string;              // ✗ Denormalized
  owes: Record<string, number>;
  owedBy: Record<string, number>;
  netBalance: number;
}
```

## Proposed Solution

### Core Principle
- Store only user IDs in Firestore documents
- Fetch user profiles dynamically from Firebase Auth when needed
- Use request-level caching to minimize API calls

### Architecture Changes

#### 1. New User Service
Create `src/services/userService.ts`:
```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

class UserService {
  private cache: Map<string, UserProfile> = new Map();
  
  async getUser(uid: string): Promise<UserProfile>;
  async getUsers(uids: string[]): Promise<Map<string, UserProfile>>;
  clearCache(): void;
}
```

#### 2. Updated Data Structures
```typescript
// Groups only store IDs
interface GroupDocument {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  memberIds: string[];  // Only keep this
  // Remove: memberEmails, members
}

// Balances only store IDs
interface UserBalance {
  userId: string;
  // Remove: name
  owes: Record<string, number>;
  owedBy: Record<string, number>;
  netBalance: number;
}
```

#### 3. API Response Enrichment
When returning data to clients, enrich with user profiles:
```typescript
// In group handlers
const group = await getGroup(groupId);
const memberProfiles = await userService.getUsers(group.memberIds);
const enrichedGroup = {
  ...group,
  members: group.memberIds.map(id => memberProfiles.get(id))
};
```

## Implementation Plan

### Phase 1: Foundation (Priority: High)

#### 1.1 Create User Service
- [ ] Create `src/services/userService.ts`
  - Single user fetch: `getUser(uid: string): Promise<UserProfile>`
  - Batch user fetch: `getUsers(uids: string[]): Promise<Map<string, UserProfile>>`
  - Request-level caching with Map<string, UserProfile>
  - Graceful error handling for missing/deleted users
  - Fallback to email for displayName if not set
- [ ] Create UserProfile interface in types
- [ ] Write comprehensive unit tests with mocked Firebase Admin SDK

#### 1.2 Update Auth Middleware  
- [ ] Enhance `AuthenticatedRequest` interface in `src/auth/middleware.ts:11-16`
  - Add `displayName?: string` to user object
  - Add `photoURL?: string` for future use
- [ ] Modify `authenticate` function to fetch user profile from Firebase Auth
  - Use `admin.auth().getUser(decodedToken.uid)` to get full profile
  - Handle cases where user record might not exist
- [ ] Update all handlers that use `req.user` to access displayName

#### 1.3 Small Commits Strategy
- **Commit 1**: Create userService.ts with interfaces and basic structure
- **Commit 2**: Add unit tests for userService  
- **Commit 3**: Update AuthenticatedRequest interface
- **Commit 4**: Enhance auth middleware to fetch user profiles
- **Commit 5**: Update any immediate dependencies

### Phase 2: Fix Critical Bug (Priority: High)

#### 2.1 Fix Share Link Join Bug  
**Location**: `src/groups/shareHandlers.ts:184-190`
- [ ] Update `joinGroupByLink` to only update `memberIds` array
- [ ] Remove lines 184-190: stop creating denormalized member object
- [ ] Remove lines 192-194, 203-204: stop updating `members` and `memberEmails` arrays
- [ ] Test with existing "Settled Group" to verify "Unknown User" bug is fixed
- **Commit**: Fix "Unknown User" bug by removing member denormalization from share links

#### 2.2 Update Balance Calculator
**Location**: `src/services/balanceCalculator.ts:37-50`  
- [ ] Inject userService dependency into `calculateGroupBalances`
- [ ] Replace member lookup (lines 37-50) with dynamic user fetching
- [ ] Remove dependency on `groupData.data?.members` array
- [ ] Use `userService.getUsers(memberIds)` instead of `memberMap`
- [ ] Update UserBalance creation (lines 68-74, 80-86) to use fetched profiles
- **Commit**: Remove denormalized user data from balance calculations

#### 2.3 Update Group Handlers Response Enrichment
**Location**: `src/groups/handlers.ts:114-126`
- [ ] Replace member transformation logic with userService calls
- [ ] Update `convertGroupDocumentToGroup` to fetch member profiles dynamically  
- [ ] Remove dependency on `groupDoc.members` array
- [ ] Use `userService.getUsers(groupDoc.memberIds)` for member data
- **Commit**: Enrich group responses with dynamic user profile fetching

#### 2.4 Update Type Definitions (Gradual)
- [ ] Mark `members` and `memberEmails` as optional in GroupDocument (keep for backwards compatibility)
- [ ] Remove `name` field from UserBalance interface  
- [ ] Update webapp-shared-types to expect dynamic member enrichment
- **Commit**: Update type definitions to reflect denormalization removal

### Phase 3: Cleanup and Optimization (Priority: Low)

#### 3.1 Remove Legacy Fields (After Phase 2 is stable)
- [ ] Remove creation of `members` and `memberEmails` arrays from group creation
- [ ] Update group validation to not expect these fields
- [ ] Remove any remaining references to denormalized member data
- **Commit**: Remove legacy denormalized field creation

#### 3.2 Performance Optimization
- [ ] Add request-level caching optimization in userService  
- [ ] Consider batch user fetching in group list operations
- [ ] Monitor Firebase Auth API usage and optimize if needed
- **Commit**: Optimize user profile fetching performance

#### 3.3 Migration Considerations
- **No data migration needed** - this is a read-only change
- Existing data with denormalized fields will be ignored, not deleted
- Backwards compatibility maintained by making fields optional

## Testing Strategy

### Unit Tests
- [ ] User service tests
- [ ] Auth middleware tests
- [ ] Handler tests with mocked user service

### Integration Tests
- [ ] Test group creation without denormalized data
- [ ] Test member joins via share link
- [ ] Test balance calculations with dynamic user fetch
- [ ] Test API responses include user data

### Performance Tests
- [ ] Measure impact of additional Auth API calls
- [ ] Verify caching reduces redundant calls
- [ ] Load test with many group members

## Rollback Plan

If issues arise:
1. Code is backwards compatible - old data still works
2. Can revert code changes without data migration
3. Monitor error rates and performance metrics
4. Have feature flag ready if gradual rollout needed

## Success Metrics

1. **No More "Unknown User"**: All users display correctly
2. **Profile Updates**: Changed names appear immediately
3. **Performance**: No significant latency increase
4. **Simplicity**: Reduced code complexity
5. **Reliability**: Fewer data sync issues

## Revised Timeline Estimate

**Phase 1: Foundation (2-3 days)**
- Day 1: Create userService.ts + unit tests (Commits 1-2)
- Day 2: Update auth middleware + interface (Commits 3-4)  
- Day 3: Test integration and fix any issues (Commit 5)

**Phase 2: Critical Bug Fix (2-3 days)**  
- Day 1: Fix share link join bug (Commit 6) - **Immediate user impact**
- Day 2: Update balance calculator (Commit 7)
- Day 3: Update group handlers + types (Commits 8-9)

**Phase 3: Cleanup (1 day)**
- Day 1: Remove legacy code + optimize (Commits 10-11)

**Total: 5-7 days** (significantly reduced scope focusing on the actual problem)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase Auth API rate limits | High | Implement caching, batch requests |
| Performance degradation | Medium | Request-level cache, monitoring |
| Missing user data | Low | Graceful fallbacks, error handling |
| Backwards compatibility | Low | Keep reading old fields, ignore them |

## Specific Implementation Steps (Ready to Execute)

### Step 1: Create UserService Foundation
```typescript
// src/services/userService.ts - New file
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

class UserService {
  private cache = new Map<string, UserProfile>();
  
  async getUser(uid: string): Promise<UserProfile> {
    // Implementation with Firebase Admin SDK
  }
  
  async getUsers(uids: string[]): Promise<Map<string, UserProfile>> {
    // Batch implementation
  }
}
```

### Step 2: Fix the Critical Bug First
```typescript  
// src/groups/shareHandlers.ts:184-207 - Remove these lines:
// const newMember = { uid, name, initials, role, joinedAt };
// 'data.members': [...currentMembers, newMember],
// 'data.memberEmails': [...currentEmails, userEmail],

// Keep only:
// 'data.memberIds': allMemberIds,
```

### Step 3: Update Balance Calculator
```typescript
// src/services/balanceCalculator.ts - Inject userService
// Replace lines 37-50 member lookup with userService.getUsers(memberIds)
```

This plan is now **actionable with specific line numbers and code changes** identified.

## References

- [Firebase Admin SDK - User Management](https://firebase.google.com/docs/auth/admin/manage-users)
- Current code locations:
  - Group handlers: `src/groups/handlers.ts`
  - Share handlers: `src/groups/shareHandlers.ts`
  - Balance calculator: `src/services/balanceCalculator.ts`
  - Type definitions: `src/types/`