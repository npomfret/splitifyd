# Breaking Changes: Document to Group Endpoints Migration

## Overview

This document details all breaking changes when migrating from generic document endpoints to typed group endpoints.

## API Changes

### 1. Endpoint URLs

| Operation | Old URL | New URL |
|-----------|---------|---------|
| Create | `POST /api/createDocument` | `POST /api/groups` |
| Read | `GET /api/getDocument?id={id}` | `GET /api/groups/{id}` |
| Update | `PUT /api/updateDocument?id={id}` | `PUT /api/groups/{id}` |
| Delete | `DELETE /api/deleteDocument?id={id}` | `DELETE /api/groups/{id}` |
| List | `GET /api/listDocuments` | `GET /api/groups` |

### 2. Request Body Structure

#### Create Group
**Old Structure:**
```json
{
  "data": {
    "name": "Weekend Trip",
    "description": "Beach vacation expenses",
    "memberEmails": ["user@example.com"],
    "members": [{"uid": "123", "name": "John", "initials": "JD"}],
    "yourBalance": 0
  }
}
```

**New Structure:**
```json
{
  "name": "Weekend Trip",
  "description": "Beach vacation expenses",
  "memberEmails": ["user@example.com"]
}
```

**Changes:**
- No `data` wrapper
- `members` array auto-populated from authenticated user
- `yourBalance` calculated server-side

#### Update Group
**Old Structure:**
```json
{
  "data": {
    "name": "Updated Name",
    "description": "Updated description"
  }
}
```

**New Structure:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

**Changes:**
- No `data` wrapper
- Direct property updates

### 3. Response Structure

#### Single Group Response
**Old Structure:**
```json
{
  "id": "group123",
  "data": {
    "name": "Weekend Trip",
    "description": "Beach vacation",
    "members": [...],
    "memberEmails": [...],
    "yourBalance": 25.50,
    "expenseCount": 5,
    "lastExpenseTime": "2024-01-15T10:00:00Z"
  },
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

**New Structure:**
```json
{
  "id": "group123",
  "name": "Weekend Trip",
  "description": "Beach vacation",
  "members": [...],
  "memberIds": ["user1", "user2"],
  "memberEmails": ["user1@example.com", "user2@example.com"],
  "balance": {
    "userBalance": 25.50,
    "totalOwed": 50.00,
    "totalOwing": 24.50
  },
  "expenseCount": 5,
  "lastExpenseTime": "2024-01-15T10:00:00Z",
  "createdBy": "user1",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

**Changes:**
- Flattened structure (no `data` wrapper)
- `yourBalance` → `balance.userBalance` with additional balance info
- Added `memberIds` array
- Added `createdBy` field

#### List Groups Response
**Old Structure:**
```json
{
  "documents": [
    {
      "id": "group123",
      "data": {...},
      "createdAt": "...",
      "updatedAt": "...",
      "balance": {
        "userBalance": 25.50,
        "totalOwed": 50.00,
        "totalOwing": 24.50
      }
    }
  ],
  "count": 10,
  "hasMore": true,
  "nextCursor": "...",
  "pagination": {
    "limit": 10,
    "order": "desc",
    "totalReturned": 10
  }
}
```

**New Structure:**
```json
{
  "groups": [
    {
      "id": "group123",
      "name": "Weekend Trip",
      "description": "...",
      "memberCount": 5,
      "balance": {
        "userBalance": 25.50,
        "totalOwed": 50.00,
        "totalOwing": 24.50
      },
      "lastActivity": "2 hours ago",
      "lastExpense": {...},
      "expenseCount": 5
    }
  ],
  "count": 10,
  "hasMore": true,
  "nextCursor": "...",
  "pagination": {
    "limit": 10,
    "order": "desc"
  }
}
```

**Changes:**
- `documents` → `groups`
- Flattened group structure
- Added `memberCount` for display
- Added formatted `lastActivity`
- Removed `totalReturned` (redundant with array length)

### 4. Error Messages

| Scenario | Old Message | New Message |
|----------|-------------|-------------|
| Not found | "Document not found" | "Group not found" |
| No access | "Document not found" | "You don't have access to this group" |
| Invalid data | "Invalid document data" | "Invalid group data" |
| Too large | "Document too large" | "Group data too large" |

### 5. TypeScript Interface Changes

#### Frontend Types
**Old:**
```typescript
interface DocumentResponse {
  id: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

interface GroupDocument extends DocumentResponse {
  data: {
    name: string;
    description?: string;
    members: Member[];
    // ... other fields
  };
}
```

**New:**
```typescript
interface Group {
  id: string;
  name: string;
  description?: string;
  members: Member[];
  memberIds: string[];
  memberEmails: string[];
  balance: GroupBalance;
  expenseCount: number;
  lastExpenseTime?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface GroupBalance {
  userBalance: number;
  totalOwed: number;
  totalOwing: number;
}
```

## Frontend Code Changes

### API Client Updates

**Old Code:**
```typescript
// api.ts
async getGroups(): Promise<TransformedGroup[]> {
  const data = await apiCall<ListDocumentsResponse>('/listDocuments', {
    method: 'GET'
  });
  return this._transformGroupsData(data.documents);
}

async createGroup(groupData: CreateGroupRequest): Promise<TransformedGroup> {
  const groupDoc = {
    data: {
      name: groupData.name,
      description: groupData.description,
      memberEmails: groupData.memberEmails,
      members: [{ uid: authManager.getUserId(), name: 'You', initials: 'YO' }]
    }
  };
  
  const data = await apiCall<{ id: string }>('/createDocument', {
    method: 'POST',
    body: JSON.stringify(groupDoc)
  });
  
  return { id: data.id, ...groupDoc.data };
}
```

**New Code:**
```typescript
// api.ts
async getGroups(): Promise<Group[]> {
  const data = await apiCall<GroupListResponse>('/groups', {
    method: 'GET'
  });
  return data.groups;
}

async createGroup(groupData: CreateGroupRequest): Promise<Group> {
  const data = await apiCall<Group>('/groups', {
    method: 'POST',
    body: JSON.stringify(groupData)
  });
  
  return data;
}
```

### Component Updates

All components using group data need updates:
- Remove `.data` property access
- Update type imports
- Adjust for flattened structure

## Backend Code Changes

### Handler Signature Changes

**Old:**
```typescript
export const createDocument = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { data } = validateCreateDocument(req.body);
  // ... create document with data wrapper
}
```

**New:**
```typescript
export const createGroup = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const groupData = validateCreateGroup(req.body);
  // ... create group directly
}
```

## Migration Checklist

### Frontend
- [ ] Update API client methods
- [ ] Update TypeScript interfaces
- [ ] Remove `.data` property access
- [ ] Update error handling for new messages
- [ ] Test all group operations

### Backend
- [ ] Implement new endpoints
- [ ] Update validation schemas
- [ ] Migrate route definitions
- [ ] Update error messages
- [ ] Add deprecation warnings

### Testing
- [ ] Update integration tests
- [ ] Update unit tests
- [ ] Test backward compatibility
- [ ] Verify data integrity

### Documentation
- [ ] Update API documentation
- [ ] Update client examples
- [ ] Document migration steps
- [ ] Update error code references

## Backward Compatibility

During transition period:
1. Both endpoints will be available
2. Old endpoints will log deprecation warnings
3. Response headers will include: `X-Deprecated: Use /api/groups instead`
4. Feature flag `USE_NEW_GROUP_API` controls client behavior

## Data Migration

**No data migration required** - the underlying Firestore structure remains the same. Only the API interface changes.

## Timeline

- **Weeks 1-2**: Both endpoints available
- **Week 3**: Deprecation warnings added
- **Week 4**: Monitor for remaining usage
- **Week 6**: Remove old endpoints

## Support

For migration assistance:
1. Check logs for deprecation warnings
2. Use feature flag for gradual rollout
3. Test thoroughly in development first