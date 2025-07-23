# Webapp Type Consolidation & API Alignment

## Status: Ready for Implementation

## Progress Tracking
- [ ] Commit 1: Remove Duplicate Types
- [ ] Commit 2: Update API Response Types  
- [ ] Commit 3: Fix API Validation Schemas
- [ ] Commit 4: Update Stores to Use Unified Types
- [ ] Commit 5: Update Components for New Data Structure
- [ ] Commit 6: Final Testing and Cleanup

## Problem Analysis

### Current Type Proliferation
The webapp currently has multiple overlapping types for essentially the same data:

1. **`TransformedGroup`** - Used by groups store and dashboard
2. **`GroupSummary`** - Defined in webapp-shared-types but unused
3. **`Group`** - Base group interface 
4. **`GroupDetail`** - For single group view (extends Group with no additions)

### API Validation Errors
Dashboard shows "Failed to load groups" with error:
```
Response from /groups does not match expected type
```

**Root Cause:** API returns different structure than schema expects:

**API Response:**
```json
{
  "groups": [...],
  "count": 4,
  "hasMore": false,
  "pagination": { "limit": 100, "order": "desc" }
}
```

**Schema Expects:**
```typescript
{ groups: TransformedGroup[] }
```

### Data Structure Mismatch
**API returns groups with:**
```json
{
  "balance": {
    "userBalance": { "netBalance": 0 },
    "totalOwed": 0,
    "totalOwing": 0
  }
}
```

**TransformedGroup expects:**
```typescript
{ yourBalance: number }
```

## Proposed Solution: Single `Group` Type

### Core Principle
**Use one `Group` interface for both list and detail views**, with optional fields that are only populated when available.

### New Group Interface
```typescript
interface Group {
  // Always present
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  balance: {
    userBalance: {
      userId: string;
      name: string;
      netBalance: number;
      owes: Record<string, number>;
      owedBy: Record<string, number>;
    };
    totalOwed: number;
    totalOwing: number;
  };
  lastActivity: string;
  lastActivityRaw: string;
  expenseCount: number;
  lastExpense?: {
    description: string;
    amount: number;
    date: string;
  };
  
  // Optional - only in detail view
  members?: User[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### API Response Types
```typescript
interface ListGroupsResponse {
  groups: Group[];
  count: number;
  hasMore: boolean;
  pagination: {
    limit: number;
    order: string;
  };
}

// Single group endpoint returns Group with all fields populated
type GroupDetailResponse = Group;
```

## Implementation Plan

### Commit 1: Remove Duplicate Types (15 minutes)
**Goal:** Clean up type proliferation by removing unused/duplicate types

1. **Delete duplicate types** from webapp-shared-types.ts:
   - Remove `TransformedGroup` interface
   - Remove `GroupSummary` interface (unused)
   - Remove `GroupDetail` interface (no added value)
2. **Update all imports** to use base `Group` type
3. **Run build** to catch any missed imports

**Verification:** `npm run build` passes with no type errors

### Commit 2: Update API Response Types (15 minutes)
**Goal:** Align API contract types with actual API responses

1. **Update `ListGroupsResponse`** in apiContract.ts:
   ```typescript
   interface ListGroupsResponse {
     groups: Group[];
     count: number;
     hasMore: boolean;
     pagination: { limit: number; order: string; };
   }
   ```
2. **Update endpoint response types**:
   - `/groups` returns `ListGroupsResponse`
   - `/groups/:id` returns `Group` (not GroupDetail)
3. **Update any API client types** that reference old types

**Verification:** TypeScript compilation passes

### Commit 3: Fix API Validation Schemas (20 minutes)
**Goal:** Make schemas match actual API responses to fix validation errors

1. **Update `ListGroupsResponseSchema`** to include all fields:
   - Add count, hasMore, pagination to schema
   - Ensure groups array uses consolidated GroupSchema
2. **Consolidate group schemas**:
   - Create single `GroupSchema` for all group data
   - Remove `TransformedGroupSchema` and similar duplicates
3. **Update schema mappings** in apiSchemas.ts

**Verification:** Dashboard no longer shows "Failed to load groups" error

### Commit 4: Update Stores to Use Unified Types (20 minutes)
**Goal:** Remove transformation logic and use Group type consistently

1. **Update GroupsStore**:
   - Change state type from `TransformedGroup[]` to `Group[]`
   - Remove any transformation logic in `loadGroups()`
   - Update method return types
2. **Update GroupDetailStore**:
   - Use `Group` type instead of `GroupDetail`
   - Ensure proper handling of optional fields
3. **Fix any store tests** that rely on old types

**Verification:** Stores work with real API data

### Commit 5: Update Components for New Data Structure (30 minutes)
**Goal:** Fix component property access for new unified type

1. **Update dashboard components**:
   - Change `group.yourBalance` to `group.balance.userBalance.netBalance`
   - Update GroupCard and related components
2. **Update group detail components**:
   - Handle optional fields with proper guards
   - Update prop types from `GroupDetail` to `Group`
3. **Search and fix** any hardcoded property access patterns

**Verification:** Dashboard and group detail pages render correctly

### Commit 6: Final Testing and Cleanup (10 minutes)
**Goal:** Ensure everything works end-to-end

1. **Manual testing**:
   - Dashboard loads and displays groups
   - Group detail page shows all information
   - No console errors or warnings
2. **Run all tests**: `npm test`
3. **Build verification**: `npm run build`
4. **Remove any TODO comments** added during refactor

**Verification:** All features work, no regressions

## Expected Benefits

### Immediate Fixes
- ✅ Dashboard "Failed to load groups" error resolved
- ✅ GroupDetailPage blank screen issue resolved  
- ✅ API validation errors eliminated

### Long-term Benefits
- **Simplified mental model** - one type for group data
- **Reduced maintenance** - no transformation logic to maintain
- **Better type safety** - components know exactly what's available
- **Clearer data flow** - API response matches frontend types
- **Easier debugging** - no mysterious type conversions

## Files to Modify

### Type Definitions
- `webapp-v2/src/types/webapp-shared-types.ts` - Remove duplicate types
- `webapp-v2/src/api/apiContract.ts` - Update response types
- `webapp-v2/src/api/apiSchemas.ts` - Consolidate schemas

### Stores
- `webapp-v2/src/app/stores/groups-store.ts` - Use Group type
- `webapp-v2/src/app/stores/group-detail-store.ts` - Use Group type

### Components
- `webapp-v2/src/pages/DashboardPage.tsx` - Update group access
- `webapp-v2/src/pages/GroupDetailPage.tsx` - Handle optional fields
- `webapp-v2/src/components/dashboard/*` - Update prop types
- `webapp-v2/src/components/group/*` - Update prop types

## Risk Assessment

### Low Risk
- Changes are mostly mechanical type updates
- No business logic changes required
- API structure remains the same

### Mitigation
- Test thoroughly after each phase
- Keep git history clean with focused commits
- Can revert individual changes if needed

## Success Criteria

- [ ] Dashboard loads groups without errors
- [ ] Group detail page renders with real data  
- [ ] All TypeScript compilation passes
- [ ] API validation schemas pass
- [ ] No runtime type errors in console
- [ ] Components handle optional fields gracefully

## Timeline

**Total Estimated Time:** 2.5 hours
**Can be completed in:** Single session
**Blocking:** Current group detail page development

## Notes

This consolidation fixes the root cause of both the dashboard API errors and the group detail page rendering issues. By aligning types with API reality, we eliminate the need for error-prone transformation layers and create a more maintainable codebase.

The approach respects the backend's well-designed data structures while simplifying the frontend's mental model of the data.