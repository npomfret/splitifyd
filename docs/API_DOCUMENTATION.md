# Splitifyd API Documentation

## Overview

The Splitifyd API is a RESTful HTTP API built on Firebase Functions that provides expense tracking and group management functionality. All API endpoints are served under the `/api` prefix.

## Base URL

- **Production**: `https://your-project.cloudfunctions.net/api`
- **Local Development**: `http://localhost:5001/your-project/us-central1/api`

## Authentication

Most endpoints require Firebase Authentication. Include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## Common Response Format

### Success Response
```json
{
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... },
    "correlationId": "unique-request-id"
  }
}
```

## API Endpoints

### Authentication

#### Register New User
Creates a new user account with Firebase Authentication and initializes user profile.

**Endpoint:** `POST /register`  
**Authentication:** None (public endpoint)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "displayName": "John Doe"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "uid": "firebase-user-id",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

**Error Responses:**
- `409 CONFLICT`: Email already exists
- `400 BAD_REQUEST`: Invalid email or password format
- `500 INTERNAL_ERROR`: Server error (orphaned auth user is cleaned up automatically)

---

### User Management

#### Create User Document
Creates or updates user profile document in Firestore.

**Endpoint:** `POST /createUserDocument`  
**Authentication:** Required

**Request Body:**
```json
{
  "displayName": "John Doe"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "User document created"
}
```

---

### Document Management

#### Create Document
Creates a new document (typically a group).

**Endpoint:** `POST /createDocument`  
**Authentication:** Required

**Request Body:**
```json
{
  "data": {
    "name": "Weekend Trip",
    "description": "Expenses for beach trip",
    "type": "group",
    "memberEmails": ["user1@example.com", "user2@example.com"]
  }
}
```

**Success Response (200):**
```json
{
  "id": "document-id",
  "message": "Document created successfully"
}
```

**Notes:**
- For group documents, automatically initializes `memberIds` array
- Document data is sanitized before storage

#### Get Document
Retrieves a single document by ID.

**Endpoint:** `GET /getDocument`  
**Authentication:** Required

**Query Parameters:**
- `id` (required): Document ID

**Success Response (200):**
```json
{
  "id": "document-id",
  "data": {
    "name": "Weekend Trip",
    "type": "group",
    "memberEmails": ["user1@example.com"],
    "memberIds": ["user-id-1"]
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Access Control:** Document owner or group member

#### Update Document
Updates an existing document.

**Endpoint:** `PUT /updateDocument`  
**Authentication:** Required

**Query Parameters:**
- `id` (required): Document ID

**Request Body:**
```json
{
  "data": {
    "name": "Updated Group Name",
    "description": "Updated description"
  }
}
```

**Success Response (200):**
```json
{
  "message": "Document updated successfully"
}
```

**Access Control:** Document owner only  
**Security:** Cannot directly modify group membership arrays

#### Delete Document
Deletes a document.

**Endpoint:** `DELETE /deleteDocument`  
**Authentication:** Required

**Query Parameters:**
- `id` (required): Document ID

**Success Response (200):**
```json
{
  "message": "Document deleted successfully"
}
```

**Access Control:** Document owner only

#### List Documents
Lists documents where the user is a member.

**Endpoint:** `GET /listDocuments`  
**Authentication:** Required

**Query Parameters:**
- `limit` (optional): Number of documents to return (default/max from config)
- `cursor` (optional): Pagination cursor
- `order` (optional): Sort order - `asc` or `desc` (default: `desc`)

**Success Response (200):**
```json
{
  "documents": [
    {
      "id": "document-id",
      "data": { ... },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "balance": {
        "userBalance": 25.50,
        "totalOwed": 50.00,
        "totalOwing": 24.50
      }
    }
  ],
  "count": 10,
  "hasMore": true,
  "nextCursor": "pagination-cursor",
  "pagination": {
    "limit": 10,
    "order": "desc",
    "totalReturned": 10
  }
}
```

**Notes:** Balance information is included for group documents

---

### Expense Management

#### Create Expense
Creates a new expense in a group.

**Endpoint:** `POST /expenses`  
**Authentication:** Required

**Request Body:**
```json
{
  "groupId": "group-id",
  "paidBy": "user-id",
  "amount": 150.00,
  "description": "Dinner at restaurant",
  "category": "Food",
  "date": "2024-01-15T20:00:00Z",
  "splitType": "equal",
  "participants": ["user-id-1", "user-id-2", "user-id-3"],
  "splits": {},
  "receiptUrl": "https://storage.example.com/receipt.jpg"
}
```

**Split Types:**
- `equal`: Amount divided equally among participants
- `exact`: Specific amounts per participant (requires `splits` object)
- `percentage`: Percentage-based split (requires `splits` object with percentages)

**Success Response (200):**
```json
{
  "id": "expense-id",
  "message": "Expense created successfully"
}
```

**Access Control:** User must be group member  
**Side Effects:** Updates group expense count and last expense time

#### Get Expense
Retrieves a single expense by ID.

**Endpoint:** `GET /expenses`  
**Authentication:** Required

**Query Parameters:**
- `id` (required): Expense ID

**Success Response (200):**
```json
{
  "id": "expense-id",
  "groupId": "group-id",
  "createdBy": "user-id",
  "paidBy": "user-id",
  "amount": 150.00,
  "description": "Dinner at restaurant",
  "category": "Food",
  "date": "2024-01-15T20:00:00Z",
  "splitType": "equal",
  "participants": ["user-id-1", "user-id-2", "user-id-3"],
  "splits": {
    "user-id-1": 50.00,
    "user-id-2": 50.00,
    "user-id-3": 50.00
  },
  "receiptUrl": "https://storage.example.com/receipt.jpg",
  "createdAt": "2024-01-15T20:30:00Z",
  "updatedAt": "2024-01-15T20:30:00Z"
}
```

**Access Control:** Group owner or expense participant

#### Update Expense
Updates an existing expense.

**Endpoint:** `PUT /expenses`  
**Authentication:** Required

**Query Parameters:**
- `id` (required): Expense ID

**Request Body:** (any fields can be updated)
```json
{
  "amount": 175.00,
  "description": "Updated description",
  "category": "Dining"
}
```

**Success Response (200):**
```json
{
  "message": "Expense updated successfully"
}
```

**Access Control:** Expense creator or group owner  
**Side Effects:**
- Creates history entry for audit trail
- Updates group last expense time if date changes
- Recalculates splits if amount/participants change

#### Delete Expense
Deletes an expense.

**Endpoint:** `DELETE /expenses`  
**Authentication:** Required

**Query Parameters:**
- `id` (required): Expense ID

**Success Response (200):**
```json
{
  "message": "Expense deleted successfully"
}
```

**Access Control:** Expense creator or group owner  
**Side Effects:** Decrements group expense count

#### List Group Expenses
Lists all expenses for a specific group.

**Endpoint:** `GET /expenses/group`  
**Authentication:** Required

**Query Parameters:**
- `groupId` (required): Group ID
- `limit` (optional): Max results per page (default: 50, max: 100)
- `cursor` (optional): Pagination cursor

**Success Response (200):**
```json
{
  "expenses": [
    {
      "id": "expense-id",
      "groupId": "group-id",
      "amount": 150.00,
      "description": "Dinner",
      "date": "2024-01-15T20:00:00Z",
      "paidBy": "user-id",
      "category": "Food",
      "splits": { ... }
    }
  ],
  "count": 25,
  "hasMore": true,
  "nextCursor": "pagination-cursor"
}
```

**Access Control:** User must be group member  
**Ordering:** By date descending, then by creation time descending

#### List User Expenses
Lists all expenses across all groups where user is a member.

**Endpoint:** `GET /expenses/user`  
**Authentication:** Required

**Query Parameters:**
- `limit` (optional): Max results per page (default: 50, max: 100)
- `cursor` (optional): Pagination cursor

**Success Response:** Same format as List Group Expenses

#### Get Expense History
Retrieves modification history for an expense.

**Endpoint:** `GET /expenses/history`  
**Authentication:** Required

**Query Parameters:**
- `id` (required): Expense ID

**Success Response (200):**
```json
{
  "history": [
    {
      "id": "history-entry-id",
      "modifiedAt": "2024-01-16T10:00:00Z",
      "modifiedBy": "user-id",
      "changeType": "update",
      "changes": ["amount", "description"],
      "previousAmount": 150.00,
      "previousDescription": "Original description",
      "previousCategory": "Food",
      "previousDate": "2024-01-15T20:00:00Z",
      "previousSplits": { ... }
    }
  ],
  "count": 2
}
```

**Access Control:** Same as expense read access  
**Limit:** Returns last 20 history entries

---

### Group Management

#### Get Group Balances
Calculates and returns current balances for all group members.

**Endpoint:** `GET /groups/balances`  
**Authentication:** Required

**Query Parameters:**
- `groupId` (required): Group ID

**Success Response (200):**
```json
{
  "groupId": "group-id",
  "userBalances": {
    "user-id-1": 25.50,
    "user-id-2": -10.00,
    "user-id-3": -15.50
  },
  "simplifiedDebts": [
    {
      "from": "user-id-2",
      "to": "user-id-1",
      "amount": 10.00
    },
    {
      "from": "user-id-3",
      "to": "user-id-1",
      "amount": 15.50
    }
  ],
  "lastUpdated": "2024-01-15T21:00:00Z"
}
```

**Access Control:** User must be group member  
**Notes:** Returns cached balances when available, calculates on-demand if not cached

#### Generate Share Link
Creates a shareable invitation link for a group.

**Endpoint:** `POST /groups/share`  
**Authentication:** Required

**Request Body:**
```json
{
  "groupId": "group-id"
}
```

**Success Response (200):**
```json
{
  "shareableUrl": "https://app.example.com/join/AbCdEfGhIjKlMnOp",
  "linkId": "AbCdEfGhIjKlMnOp"
}
```

**Access Control:** Group owner or admin member  
**Notes:** Generates 16-character secure token

#### Join Group via Link
Joins a group using a share link.

**Endpoint:** `POST /groups/join`  
**Authentication:** Required

**Request Body:**
```json
{
  "linkId": "AbCdEfGhIjKlMnOp"
}
```

**Success Response (200):**
```json
{
  "groupId": "group-id",
  "groupName": "Weekend Trip",
  "message": "Successfully joined group"
}
```

**Error Responses:**
- `404 NOT_FOUND`: Invalid or expired link
- `409 CONFLICT`: User is already a member

**Side Effects:** Adds user to group members, memberEmails, and memberIds arrays

---

### System Endpoints

#### Health Check
Checks the health of Firebase services.

**Endpoint:** `GET /health`  
**Authentication:** None

**Success Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "version": "1.0.0",
  "services": {
    "firestore": {
      "status": "healthy",
      "responseTime": 45
    },
    "auth": {
      "status": "healthy",
      "responseTime": 23
    }
  }
}
```

#### System Status
Returns detailed system metrics.

**Endpoint:** `GET /status`  
**Authentication:** None

**Success Response (200):**
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 3600,
  "memory": {
    "rss": "128 MB",
    "heapUsed": "45 MB",
    "heapTotal": "64 MB",
    "external": "2 MB"
  },
  "version": "1.0.0",
  "nodeVersion": "v18.17.0",
  "environment": "production"
}
```

#### Environment Debug
Returns environment variables and filesystem info (development only).

**Endpoint:** `GET /env`  
**Authentication:** None

**Success Response (200):**
```json
{
  "env": { ... },
  "build": {
    "timestamp": 1705321200000,
    "date": "2024-01-15T10:00:00Z",
    "version": "1.0.0"
  },
  "runtime": {
    "startTime": "2024-01-15T09:00:00Z",
    "uptime": 3600,
    "uptimeHuman": "1h 0m 0s"
  },
  "memory": { ... },
  "filesystem": {
    "currentDirectory": "/workspace",
    "files": [ ... ]
  }
}
```

#### Firebase Configuration
Returns Firebase configuration for client initialization.

**Endpoint:** `GET /config`  
**Authentication:** None

**Success Response (200):**
```json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "measurementId": "...",
  "functionBaseUrl": "...",
  "environment": "production",
  "version": "1.0.0",
  "features": { ... }
}
```

**Caching:** 5 minutes (development), 1 hour (production)

#### CSP Violation Report
Logs Content Security Policy violations.

**Endpoint:** `POST /csp-violation-report`  
**Authentication:** None

**Request Body:** CSP violation report (automatic browser format)

**Success Response (204):** No content

---

## Firestore Triggers

### Expense Write Trigger
Automatically updates group balances when expenses are created, updated, or deleted.

**Function:** `onExpenseWriteV6`  
**Trigger:** Firestore document write on `expenses/{expenseId}`

**Operations:**
1. On create/update: Recalculates and caches group balances
2. On delete: Recalculates and caches group balances
3. Updates group statistics (expense count, last expense time)

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request validation failed |
| `UNAUTHORIZED` | Authentication required or invalid token |
| `FORBIDDEN` | User lacks permission for this operation |
| `NOT_FOUND` | Requested resource not found |
| `CONFLICT` | Operation conflicts with existing data |
| `INTERNAL_ERROR` | Server error occurred |
| `VALIDATION_ERROR` | Input validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

---

## Rate Limits

- Default: 100 requests per minute per user
- Burst: 20 requests per second per user
- Group operations: 50 per minute per group

---

## Best Practices

1. **Authentication**: Always validate tokens on the client before making requests
2. **Pagination**: Use cursor-based pagination for large datasets
3. **Error Handling**: Implement exponential backoff for retries
4. **Caching**: Respect cache headers for configuration endpoints
5. **Validation**: Validate inputs client-side to reduce server load
6. **Batch Operations**: Use transactions when modifying related data

---

## Security Considerations

1. **Access Control**: Multi-level permission checks on all endpoints
2. **Data Sanitization**: All user inputs are sanitized before storage
3. **Audit Trail**: Expense modifications create immutable history records
4. **Rate Limiting**: Prevents abuse and ensures fair usage
5. **CORS**: Configured for specific allowed origins
6. **CSP**: Content Security Policy enforced with violation reporting