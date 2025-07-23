# Webapp Type Consolidation & API Alignment

## Status: Ready for Implementation

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

### Phase 1: Remove Duplicate Types (30 minutes)
1. **Delete `TransformedGroup`** from webapp-shared-types.ts
2. **Delete `GroupSummary`** from webapp-shared-types.ts  
3. **Delete `GroupDetail`** from webapp-shared-types.ts
4. **Update imports** across codebase to use `Group`

### Phase 2: Update API Contracts (15 minutes)
1. **Update `ListGroupsResponse`** in apiContract.ts to include pagination fields
2. **Change `/groups/:id` response** from `GroupDetail` to `Group`
3. **Update all endpoint types** to use `Group`

### Phase 3: Fix API Schemas (15 minutes)
1. **Update `ListGroupsResponseSchema`** to include count, hasMore, pagination
2. **Create single `GroupSchema`** to replace multiple overlapping schemas
3. **Update response schema mapping** to use consolidated schemas

### Phase 4: Update Stores (20 minutes)
1. **Update `GroupsStore`** to use `Group[]` instead of `TransformedGroup[]`
2. **Remove transformation logic** from groups store
3. **Update `GroupDetailStore`** to use `Group` type
4. **Fix store method signatures**

### Phase 5: Update Components (30 minutes)
1. **Update dashboard components** to use `group.balance.userBalance.netBalance`
2. **Update group detail components** to handle optional fields
3. **Fix component prop types** to use `Group`
4. **Update any hardcoded property access**

### Phase 6: Testing & Validation (20 minutes)
1. **Test dashboard** - should load groups without errors
2. **Test group detail page** - should render with real data
3. **Verify API validation** passes with new schemas
4. **Test with missing optional fields**

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