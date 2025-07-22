# API Endpoint Inventory

## Overview

This document provides a comprehensive inventory of all API endpoints in the Splitifyd application, documenting the contract between the webapp client and Firebase Functions backend.

## Authentication

All endpoints except those marked as "Public" require authentication via Firebase Auth Bearer token in the Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

## Base URL

All API endpoints are prefixed with `/api` in production:
- Production: `https://[project-id].cloudfunctions.net/api`
- Local Emulator: `http://localhost:5001/[project-id]/us-central1/api`

## Endpoints

### 1. Configuration & Health

#### GET /config
**Public endpoint**
- **Purpose**: Get Firebase configuration for client initialization
- **Response**: `AppConfiguration`
```typescript
interface AppConfiguration {
  firebase: FirebaseConfig;
  api: ApiConfig;
  environment: EnvironmentConfig;
  formDefaults: FormDefaults;
  firebaseAuthUrl?: string; // Only in development
}
```

#### GET /health
**Public endpoint**
- **Purpose**: Health check for monitoring
- **Response**: Health check status with service response times
```typescript
{
  checks: {
    firestore: { status: 'healthy' | 'unhealthy', responseTime?: number },
    auth: { status: 'healthy' | 'unhealthy', responseTime?: number }
  }
}
```

#### GET /status
**Public endpoint**
- **Purpose**: Detailed system status
- **Response**: Memory usage, uptime, version info

#### GET /env
**Public endpoint**
- **Purpose**: Debug endpoint (development only)
- **Response**: Environment variables, build info, file system

#### POST /csp-violation-report
**Public endpoint**
- **Purpose**: Content Security Policy violation reporting
- **Request**: CSP violation report (browser-generated)
- **Response**: 204 No Content

### 2. Authentication

#### POST /register
**Public endpoint**
- **Purpose**: Register new user account (Firebase Auth)
- **Request**: 
```typescript
{
  email: string;
  password: string;
  displayName: string;
}
```
- **Response**: User created in Firebase Auth
- **Note**: This endpoint exists but the webapp uses Firebase Auth SDK directly

#### POST /createUserDocument
**Requires Auth**
- **Purpose**: Create user document in Firestore after registration
- **Request**: User data from Firebase Auth
- **Response**: User document created

### 3. Groups

#### GET /groups
**Requires Auth**
- **Purpose**: List all groups for authenticated user
- **Response**: `TransformedGroup[]`
```typescript
interface TransformedGroup {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: number;
  lastActivity: string;
  lastActivityRaw: string;
  lastExpense: { description: string; amount: number; date: string } | null;
  members: Member[];
  expenseCount: number;
  lastExpenseTime: string | null;
}
```

#### POST /groups
**Requires Auth**
- **Purpose**: Create a new group
- **Request**: `CreateGroupRequest`
```typescript
interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails?: string[];
}
```
- **Response**: `TransformedGroup`

#### GET /groups/:id
**Requires Auth**
- **Purpose**: Get single group details
- **Response**: `GroupDetail`
```typescript
interface GroupDetail {
  id: string;
  name: string;
  description: string;
  members: Member[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

#### PUT /groups/:id
**Requires Auth**
- **Purpose**: Update group details
- **Request**: Partial<GroupDetail>
- **Response**: Updated group data

#### DELETE /groups/:id
**Requires Auth**
- **Purpose**: Delete a group
- **Response**: `{ success: boolean }`

#### GET /groups/balances?groupId={groupId}
**Requires Auth**
- **Purpose**: Get balance information for a group
- **Response**: `GroupBalances`
```typescript
interface GroupBalances {
  balances: Array<{
    userId: string;
    userName: string;
    balance: number;
    owes: Array<{ userId: string; userName: string; amount: number }>;
    owedBy: Array<{ userId: string; userName: string; amount: number }>;
  }>;
  simplifiedDebts: Array<{
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    amount: number;
  }>;
}
```

#### POST /groups/share
**Requires Auth**
- **Purpose**: Generate shareable link for group
- **Request**: `{ groupId: string }`
- **Response**: `ShareableLinkResponse`
```typescript
interface ShareableLinkResponse {
  linkId: string;
  shareUrl: string;
  expiresAt: string;
}
```

#### POST /groups/join
**Requires Auth**
- **Purpose**: Join a group via shareable link
- **Request**: `{ linkId: string }`
- **Response**: `JoinGroupResponse`
```typescript
interface JoinGroupResponse {
  groupId: string;
  groupName: string;
  success: boolean;
}
```

### 4. Expenses

#### POST /expenses
**Requires Auth**
- **Purpose**: Create a new expense
- **Request**: `CreateExpenseRequest`
```typescript
interface CreateExpenseRequest {
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits?: ExpenseSplit[];
  receiptUrl?: string;
}
```
- **Response**: `ExpenseData`

#### GET /expenses?id={expenseId}
**Requires Auth**
- **Purpose**: Get single expense details
- **Response**: `ExpenseData`
```typescript
interface ExpenseData {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  paidByName?: string;
  category: string;
  date: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits: ExpenseSplit[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  receiptUrl?: string;
}
```

#### PUT /expenses?id={expenseId}
**Requires Auth**
- **Purpose**: Update an expense
- **Request**: `UpdateExpenseRequest` (partial)
- **Response**: Updated `ExpenseData`

#### DELETE /expenses?id={expenseId}
**Requires Auth**
- **Purpose**: Delete an expense
- **Response**: Success confirmation

#### GET /expenses/group?groupId={groupId}&limit={limit}&cursor={cursor}
**Requires Auth**
- **Purpose**: List expenses for a group with pagination
- **Query Parameters**:
  - `groupId`: string (required)
  - `limit`: number (default: 20)
  - `cursor`: string (optional, for pagination)
- **Response**: 
```typescript
{
  expenses: ExpenseData[];
  count: number;
  hasMore: boolean;
  nextCursor?: string;
}
```

#### GET /expenses/user
**Requires Auth**
- **Purpose**: List all expenses for the authenticated user
- **Response**: Similar to group expenses endpoint

#### GET /expenses/history?id={expenseId}
**Requires Auth**
- **Purpose**: Get edit history for an expense
- **Response**: `{ history: any[] }`

## Common Types

### Member
```typescript
interface Member {
  uid: string;
  name: string;
  initials: string;
  email?: string;
  displayName?: string;
  joinedAt?: string;
}
```

### ExpenseSplit
```typescript
interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
  userName?: string;
}
```

## Error Responses

All endpoints return errors in a consistent format:
```typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Missing or invalid auth token
- `FORBIDDEN` - User lacks permission
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `INTERNAL_ERROR` - Server error

## Authentication Flow

1. **Registration/Login**: Webapp uses Firebase Auth SDK directly (not API endpoints)
2. **Token Retrieval**: Get ID token from Firebase Auth: `user.getIdToken()`
3. **API Calls**: Include token in Authorization header
4. **Token Refresh**: Firebase SDK handles token refresh automatically

## Known Issues

1. **Balance Loading Error**: `/groups/balances` endpoint returns 404 for some groups
2. **Password Reset**: Reset password functionality not working (uses Firebase Auth)
3. **Type Mismatches**: Some endpoints return `$NaN` for balance amounts, indicating type coercion issues

## Migration Considerations

1. **Shared Types**: Need to establish proper shared types between client and server
2. **Runtime Validation**: Client should validate all server responses
3. **Type Safety**: All endpoints need strict TypeScript types
4. **Error Handling**: Consistent error format across all endpoints
5. **Authentication**: Consider moving auth endpoints to API for consistency

---

*Last Updated: 2025-07-22*