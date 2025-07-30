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
- [ ] Implement single user fetch with Firebase Admin SDK
- [ ] Implement batch user fetch (up to 100 users)
- [ ] Add request-level caching
- [ ] Add error handling for missing users
- [ ] Write unit tests

#### 1.2 Update Auth Middleware
- [ ] Modify auth middleware to fetch full user profile
- [ ] Add displayName to req.user object
- [ ] Update AuthenticatedRequest interface

### Phase 2: Remove Denormalization (Priority: High)

#### 2.1 Update Type Definitions
- [ ] Remove `memberEmails` from GroupDocument
- [ ] Remove `members` from GroupDocument  
- [ ] Remove `name` from UserBalance
- [ ] Update webapp-shared-types.ts
- [ ] Update server-types.ts

#### 2.2 Update Group Handlers
- [ ] Modify `createGroup` to only store memberIds
- [ ] Update `getGroup` to fetch member profiles dynamically
- [ ] Update `listGroups` to work without denormalized data
- [ ] Remove member email/name storage logic

#### 2.3 Fix Share Link Join
- [ ] Update `joinGroupByLink` to only add uid to memberIds
- [ ] Remove creation of member object with name/email
- [ ] Ensure consistent member list updates

#### 2.4 Update Balance Calculator
- [ ] Modify to fetch user names when needed
- [ ] Update balance response to include user names
- [ ] Cache user data during calculation

### Phase 3: API Response Updates (Priority: Medium)

#### 3.1 Group Responses
- [ ] Ensure all group endpoints return member data
- [ ] Add user profile enrichment to responses
- [ ] Update response schemas

#### 3.2 Balance Responses  
- [ ] Add user names to balance responses
- [ ] Update simplified debt responses
- [ ] Ensure consistent naming across endpoints

### Phase 4: Cleanup (Priority: Low)

#### 4.1 Remove Legacy Code
- [ ] Remove unused member transformation functions
- [ ] Clean up validation schemas
- [ ] Remove redundant type definitions

#### 4.2 Migration Considerations
- [ ] Document that existing data will still work
- [ ] No data migration needed (read-only change)
- [ ] Old denormalized data ignored, not deleted

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

## Timeline Estimate

- Phase 1: 2-3 days (Foundation)
- Phase 2: 3-4 days (Core changes)
- Phase 3: 2 days (API updates)
- Phase 4: 1 day (Cleanup)
- Testing: 2-3 days

**Total: 10-15 days**

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase Auth API rate limits | High | Implement caching, batch requests |
| Performance degradation | Medium | Request-level cache, monitoring |
| Missing user data | Low | Graceful fallbacks, error handling |
| Backwards compatibility | Low | Keep reading old fields, ignore them |

## Next Steps

1. Review and approve this plan
2. Create detailed tickets for each phase
3. Set up monitoring for Auth API usage
4. Begin Phase 1 implementation
5. Regular progress check-ins

## References

- [Firebase Admin SDK - User Management](https://firebase.google.com/docs/auth/admin/manage-users)
- Current code locations:
  - Group handlers: `src/groups/handlers.ts`
  - Share handlers: `src/groups/shareHandlers.ts`
  - Balance calculator: `src/services/balanceCalculator.ts`
  - Type definitions: `src/types/`