# Group Membership Lifecycle Analysis

**Last Updated**: 2025-08-19

## Status Summary

| Issue | Priority | Status | Resolution |
|-------|----------|--------|------------|
| Invalid User IDs in Expenses | P0 | ✅ FIXED | Added validation to ensure only group members can be in expenses |
| Group Creation Members | P1 | ✅ WORKING | `sanitizeGroupData` already handles members array correctly |
| Leave/Remove Member | P1 | ✅ EXISTS | Already implemented with balance checks |

## Completed Work

### 1. Fixed Security Bug: Invalid User IDs in Expenses
- **Files Modified**: 
  - `expenses/handlers.ts`: Added member validation in create/update
  - `expenses/validation.ts`: Added paidBy to update schema
  - Added comprehensive test coverage
- **Impact**: Prevents "Unknown User" displays in UI

### 2. Verified Existing Features
- Group creation properly handles members array
- Leave group (`POST /groups/:id/leave`) - implemented with balance checks
- Remove member (`DELETE /groups/:id/members/:memberId`) - owner only, with balance checks
- Frontend components already use these endpoints

## Remaining Work

### P0: Add Missing Joi Validation (Security Risk)

**Problem**: User and policy handlers don't use Joi validation, creating security vulnerabilities.

**Required Actions**:
1. Create validation schemas for user handlers (updateUser, deleteUser)
2. Create validation schemas for policy handlers
3. Replace direct `req.body` destructuring with validated data
4. Add tests for validation edge cases

**Files to Update**:
- `user/handlers.ts` - Add validation functions
- `policies/handlers.ts` - Add validation functions
- Create new `user/validation.ts` and `policies/validation.ts`

### P1: Implement Real-Time UI Updates

**Problem**: Frontend requires manual page reloads to see changes.

**Required Actions**:
1. Add Firestore `onSnapshot` listeners to frontend stores
2. Remove `page.reload()` calls from components
3. Update E2E tests to work without reloads
4. Handle offline/online state transitions

**Affected Areas**:
- Group updates (name, description, members)
- Expense creation/updates
- Balance changes
- Settlements

### P2: Documentation Cleanup

- Remove outdated TODO comments
- Update API documentation with new error codes
- Archive completed task documents

## Implementation Priority

1. **Immediate**: Fix validation gap (security issue) - 2-4 hours
2. **Next Sprint**: Real-time updates (UX improvement) - 1-2 days  
3. **When Time Permits**: Documentation cleanup - 2-3 hours