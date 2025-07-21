# Migration Plan: Remove Generic Document Endpoints

## Overview

This document outlines the plan to replace the generic document endpoints with strongly typed group endpoints. The current implementation uses untyped `data: any` fields and generic endpoint names, violating our type safety and minimalism principles.

## Progress Update (2025-07-21)

### ✅ Completed

1. **Backend Implementation**
   - Created new group types in `firebase/functions/src/types/group-types.ts`
   - Implemented new group handlers in `firebase/functions/src/groups/handlers.ts`
   - Added RESTful routes while maintaining old endpoints for compatibility
   - Fixed all TypeScript errors and achieved clean builds

2. **Frontend Updates**
   - Updated API client to support both old and new endpoints
   - Added feature flag `useNewGroupApi` for gradual rollout
   - Currently enabled in development only

3. **Key Improvements Delivered**
   - Full type safety with proper TypeScript interfaces
   - RESTful API design (`/groups` instead of `/createDocument`)
   - Simplified response structure (no `data` wrapper)
   - Better error messages ("Group not found" vs "Document not found")

### 🚧 Remaining Work

1. ✅ Update integration tests for new endpoints
2. ✅ Debug and fix 500 errors on new endpoints (fixed undefined Firestore values)
3. Remove old endpoints once new ones are working
4. Update all references to use new endpoints directly
5. Remove feature flag system

## Current State

### Generic Endpoints
- `POST /createDocument` → Creates any document with `data: any`
- `GET /getDocument` → Retrieves any document
- `PUT /updateDocument` → Updates any document
- `DELETE /deleteDocument` → Deletes any document
- `GET /listDocuments` → Lists documents where user is a member

### Problems
1. **No type safety**: Uses `data: any` throughout
2. **Confusing API**: "Document" doesn't clearly indicate these are groups
3. **Over-engineering**: Generic system for a single use case
4. **Inconsistent with other endpoints**: Expenses have specific endpoints, groups don't

## Target State

### New Group Endpoints
- `POST /groups` → Create a group with typed `Group` interface
- `GET /groups/:id` → Get a specific group
- `PUT /groups/:id` → Update a group
- `DELETE /groups/:id` → Delete a group
- `GET /groups` → List user's groups

### Benefits
1. **Full type safety** with proper TypeScript interfaces
2. **Clear, RESTful API** that's self-documenting
3. **Consistent** with expense endpoints pattern
4. **Simpler** implementation without generic abstraction

## Migration Steps

### Phase 1: Backend Preparation
1. **Create new group types** (firebase/functions/src/types/group-types.ts)
   - Define `Group`, `CreateGroupRequest`, `UpdateGroupRequest` interfaces
   - Move from generic `Document` to specific `Group` type

2. **Create new group handlers** (firebase/functions/src/groups/handlers.ts)
   - Implement typed CRUD operations
   - Reuse existing validation and security logic
   - Remove generic document abstractions

3. **Update routes** (firebase/functions/src/index.ts)
   - Add new group endpoints
   - Keep old endpoints temporarily for backward compatibility

### Phase 2: Frontend Migration
1. **Update API client** (webapp/src/js/api.ts)
   - Add methods for new group endpoints
   - Mark old methods as deprecated

2. **Create feature flag** for gradual rollout
   - Allow switching between old and new endpoints
   - Test in development before production

3. **Update all UI components**
   - Replace document references with group references
   - Update type imports

### Phase 3: Testing & Validation
1. **Update integration tests**
   - Test both old and new endpoints
   - Ensure data migration works correctly

2. **Add migration script**
   - Verify existing groups work with new endpoints
   - No data transformation needed (same underlying storage)

### Phase 4: Deprecation
1. **Add deprecation warnings** to old endpoints
2. **Monitor usage** to ensure clients have migrated
3. **Remove old endpoints** after grace period

## Implementation Details

### New Type Definitions

```typescript
// firebase/functions/src/types/group-types.ts
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  memberIds: string[];
  memberEmails: string[];
  members: Member[];
  expenseCount: number;
  lastExpenseTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  // Note: members cannot be updated directly
}
```

### Route Mapping

| Old Endpoint | New Endpoint | Notes |
|--------------|--------------|-------|
| POST /createDocument | POST /groups | Body structure changes |
| GET /getDocument?id=X | GET /groups/X | RESTful path params |
| PUT /updateDocument?id=X | PUT /groups/X | RESTful path params |
| DELETE /deleteDocument?id=X | DELETE /groups/X | RESTful path params |
| GET /listDocuments | GET /groups | Returns typed groups |

### Breaking Changes

1. **Request/Response Structure**
   - Old: `{ data: { name: "Group", ... } }`
   - New: `{ name: "Group", ... }` (no wrapper)

2. **Response Types**
   - Old: `{ id, data, createdAt, updatedAt }`
   - New: `{ id, name, description, members, ... }` (flattened)

3. **Error Codes**
   - Old: "Document not found"
   - New: "Group not found"

## Rollback Plan

If issues arise:
1. Feature flag can instantly revert to old endpoints
2. No data migration needed - same Firestore collection
3. Old endpoints remain available during transition

## Timeline

- **Week 1**: ✅ Implement backend changes with backward compatibility
- **Week 2**: ✅ Update frontend with feature flag
- **Week 3**: 🚧 Fix 500 errors and complete switchover
- **Week 4**: Remove old endpoints and feature flags

## Implementation Status

### Files Created/Modified

**New Files:**
- `firebase/functions/src/types/group-types.ts` - All group-related TypeScript interfaces
- `firebase/functions/src/groups/handlers.ts` - RESTful group endpoint handlers
- `firebase/functions/src/groups/validation.ts` - Input validation for group operations

**Modified Files:**
- `firebase/functions/src/index.ts` - Added new group routes
- `firebase/functions/src/constants.ts` - Added group-specific validation limits
- `firebase/functions/src/config.ts` - Added feature flag configuration
- `firebase/functions/src/types/webapp-shared-types.ts` - Added feature flag type
- `webapp/src/js/api.ts` - Updated to support both old and new endpoints
- `webapp/src/js/types/webapp-shared-types.ts` - Added feature flag type

### Current Behavior

- **Development**: Uses new `/groups` endpoints (feature flag enabled)
- **Production**: Uses old `/createDocument` endpoints (feature flag disabled)
- **Compatibility**: Both endpoint sets are fully functional
- **Data**: No migration needed - same Firestore structure

## Success Criteria

1. All group operations use typed endpoints
2. No `data: any` in group-related code
3. API documentation clearly shows group endpoints
4. Zero data loss during migration
5. Improved developer experience with type safety

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Client compatibility | Feature flags, gradual rollout |
| Data corruption | No data transformation needed |
| Missing functionality | Comprehensive testing |
| Performance impact | Same underlying queries |

## Notes

- The generic document system was only used for groups in production
- Test usage for user preferences can be moved to a specific endpoint if needed
- This change aligns with our principles of minimalism and type safety