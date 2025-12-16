# Important Code Guide

This document highlights the most critical classes in the codebase and documents the API conventions.

---

## Important Firebase code

These are the foundational classes every new developer should understand:

### 1. ComponentBuilder (`services/ComponentBuilder.ts`)
The dependency injection container that creates and wires all services. Start here to understand the application structure and how components connect.

### 2. FirestoreReader & FirestoreWriter (`services/firestore/`)
The data access layer abstraction. All Firestore I/O flows through these classes, which handle schema validation and Timestamp ↔ ISO string conversion at the boundary.

### 3. GroupService (`services/GroupService.ts`)
The core domain orchestrator for groups. Coordinates membership, permissions, expenses, settlements, comments, and activity events. Most group handlers are thin wrappers over this service.

### 4. ApplicationFactory (`ApplicationFactory.ts`)
The bridge between API routes and business logic. Takes services from ComponentBuilder and injects them into Handler classes, routing incoming requests to the code that handles them.

### 5. ActivityFeedService (`services/ActivityFeedService.ts`)
The backbone of real-time refresh. Every mutation service calls into it so the frontend's SSE-driven `refreshAll()` works. Missing an activity event here means clients won't auto-refresh.

---

## Important Frontend code

### 1. ApiClient (`app/apiClient.ts`)
Central API gateway implementing all three API interfaces. Handles runtime Zod validation of responses, auth token injection, 401 auto-refresh with request queuing, and structured error mapping. Every network call flows through here.

### 2. AuthStore (`app/stores/auth-store.ts`)
Authentication state manager using private signals (`#`). Handles login/logout, token refresh scheduling, user profile loading, and resets all feature stores on logout. The canonical example of the store pattern used throughout the app.

### 3. EnhancedGroupDetailStore (`app/stores/group-detail-store-enhanced.ts`)
Manages all state for a single group view: members, expenses, settlements, comments, balances. Handles pagination with cursors and coordinates with the real-time system via `GroupDetailRealtimeCoordinator`.

### 4. ActivityFeedRealtimeService (`app/services/activity-feed-realtime-service.ts`)
SSE connection to the activity feed. Fans updates to consumers, handles user switching, deduplicates events. This is why you never manually refresh after mutations - events trigger automatic `refreshAll()`.

### 5. App.tsx (`App.tsx`)
Root component with routing via preact-router, code splitting via `lazy()`, and auth guards via `ProtectedRoute`. All routes defined here. Entry point is `main.tsx` which wraps App in `AuthProvider`.

**Also important:** `components/ui/` directory contains the themed UI component library (Button, Card, Input, etc.). This is a white-label app - all UI must use these theme-aware components, not primitive HTML with hardcoded styles.

---

## API Design

The API is built on Express.js running as a Firebase Cloud Function. Firebase Hosting rewrites add an `/api` prefix that middleware strips before routing.

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/api.ts` | TypeScript interfaces defining all API methods (source of truth) |
| `packages/shared/src/shared-types.ts` | Request/response DTOs shared between client and server |
| `packages/shared/src/schemas/apiSchemas.ts` | Zod schemas for runtime response validation |
| `firebase/functions/src/routes/route-config.ts` | Route definitions mapping paths to handlers |
| `firebase/functions/src/errors/` | Error system: `ApiError`, `ErrorCode`, `Errors` factory |

### API Interface Hierarchy

Three interfaces in `packages/shared/src/api.ts` define the contract:

- **`PublicAPI`** - Unauthenticated endpoints
- **`API<AuthToken>`** - Authenticated user endpoints
- **`AdminAPI<AuthToken>`** - Admin-only endpoints

Implemented by: `webapp-v2/src/app/apiClient.ts`, `packages/test-support/src/ApiDriver.ts`, `firebase/functions/src/__tests__/unit/AppDriver.ts`

---

## HTTP Conventions

### Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET or POST returning data |
| 201 | Resource created (POST) |
| 204 | Successful mutation with no body (PUT/DELETE/PATCH) |
| 400 | Validation error or malformed request |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but lacks permission |
| 404 | Resource not found |
| 409 | Conflict (duplicate or concurrent update) |

### Return Types

- **Create** → 201 with created DTO
- **Read** → 200 with DTO or list response
- **Update** → 204 No Content (or 200 if response needed)
- **Delete** → 204 No Content

### Real-Time Refresh via Activity Feed

Mutations trigger activity feed events → SSE pushes to clients → frontend calls `refreshAll()`. Activity events are critical infrastructure - missing one means clients won't auto-refresh.

See `webapp-v2/src/app/stores/helpers/group-detail-realtime-coordinator.ts`.

---

## Route Parameters

Use resource-specific names: `:groupId`, `:expenseId`, `:settlementId`. Never use generic `:id`.

---

## Authentication

Middleware in `firebase/functions/src/auth/middleware.ts`:

- **`authenticate`** - Verifies Firebase ID token, attaches `req.user`
- **`authenticateAdmin`** - Requires `system_admin` role
- **`authenticateTenantAdmin`** - Requires `tenant_admin` or higher

Roles stored at `users/{userId}.role`: `system_admin`, `tenant_admin`, `system_user` (default).

---

## Error Handling

### Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "detail": "DETAIL_CODE",
    "resource": "group",
    "field": "amount"
  }
}
```

Two-tier codes: category codes (~12) for client i18n, detail codes (100+) for debugging.

### Errors Factory

| Factory | Code | Status | Usage |
|---------|------|--------|-------|
| `Errors.authRequired()` | `AUTH_REQUIRED` | 401 | Missing authentication |
| `Errors.authInvalid()` | `AUTH_INVALID` | 401 | Bad or expired token |
| `Errors.forbidden()` | `FORBIDDEN` | 403 | Insufficient permissions |
| `Errors.validationError()` | `VALIDATION_ERROR` | 400 | Input validation failure |
| `Errors.notFound()` | `NOT_FOUND` | 404 | Resource doesn't exist |
| `Errors.conflict()` | `CONFLICT` | 409 | Concurrent update conflict |
| `Errors.invalidRequest()` | `INVALID_REQUEST` | 400 | Business rule violation |

Let errors bubble up to the centralized handler. Avoid `try/catch` unless handling a specific recoverable case.

---

## Validation

Request validation uses Zod with `createRequestValidator`. See `docs/guides/validation.md`.

- Shared schemas: `packages/shared/src/schemas/`
- Handler-specific: `{module}/validation.ts` files
- Query params validated explicitly, not silent defaults

Frontend validates responses at runtime using schemas from `packages/shared/src/schemas/apiSchemas.ts`.

---

## Type Safety

### Branded Types

Identifiers use branded types to prevent mixing: `GroupId`, `ExpenseId`, `SettlementId`, `UserId`, `PolicyId`, `DisplayName`, `Email`, `ShareLinkToken`.

See `packages/shared/src/shared-types.ts`.

### Request/Response Types

All request/response types defined in the shared package. See `docs/guides/types.md`.

---

## Adding New Endpoints

1. Define method in `packages/shared/src/api.ts`
2. Define types in `packages/shared/src/shared-types.ts`
3. Add response schema to `packages/shared/src/schemas/apiSchemas.ts`
4. Create handler in `firebase/functions/src/`
5. Add validation using `createRequestValidator`
6. Register route in `firebase/functions/src/routes/route-config.ts`
7. Implement in API drivers (ApiClient, ApiDriver, AppDriver)
8. Test it here: @firebase/functions/src/__tests__/unit/api

---

## Testing

| Type | Driver | Description |
|------|--------|-------------|
| Unit | `AppDriver` | Calls handlers directly, in-memory Firestore simulator |
| Integration | `ApiDriver` | Real HTTP against Firebase Emulator |
| Schema | `api-schemas.test.ts` | Verifies response schemas match endpoints |
