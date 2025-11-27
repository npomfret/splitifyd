# API Design Guide

This document describes the patterns, conventions, and standards for the REST API layer.

---

## Architecture Overview

The API is built on Express.js running as a Firebase Cloud Function. All routes are served beneath the `api` Cloud Function, with Firebase Hosting rewrites adding an `/api` prefix that middleware strips before routing.

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/api.ts` | TypeScript interface defining all API methods - the single source of truth for the API contract |
| `packages/shared/src/shared-types.ts` | Request and response DTOs shared between client and server |
| `packages/shared/src/schemas/apiSchemas.ts` | Zod schemas for runtime response validation |
| `firebase/functions/src/index.ts` | Express app entry point, route registration |
| `firebase/functions/src/routes/route-config.ts` | Route definitions mapping paths to handlers |
| `firebase/functions/src/utils/errors.ts` | `ApiError` class and standard error factory (`Errors`) |
| `firebase/functions/src/constants.ts` | `HTTP_STATUS` codes and other constants |

### API Interface Hierarchy

The API contract is defined by three TypeScript interfaces in `packages/shared/src/api.ts`:

- **`PublicAPI`** - Unauthenticated endpoints (e.g., fetching published policies)
- **`API<AuthToken>`** - Authenticated user endpoints (groups, expenses, settlements, profile)
- **`AdminAPI<AuthToken>`** - Admin-only endpoints requiring elevated roles

These interfaces are implemented by:
- Web client (`webapp-v2/src/app/apiClient.ts`)
- HTTP integration driver (`packages/test-support/src/ApiDriver.ts`)
- In-memory unit test driver (`firebase/functions/src/__tests__/unit/AppDriver.ts`)

---

## HTTP Conventions

### Status Codes

| Code | Constant | Usage |
|------|----------|-------|
| 200 | `HTTP_STATUS.OK` | Successful GET, or POST that returns data |
| 201 | `HTTP_STATUS.CREATED` | Resource created (POST returning the new resource) |
| 204 | `HTTP_STATUS.NO_CONTENT` | Successful mutation with no response body (PUT, DELETE, PATCH) |
| 400 | `HTTP_STATUS.BAD_REQUEST` | Validation error, malformed request |
| 401 | `HTTP_STATUS.UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `HTTP_STATUS.FORBIDDEN` | Authenticated but lacks permission |
| 404 | `HTTP_STATUS.NOT_FOUND` | Resource does not exist |
| 409 | `HTTP_STATUS.CONFLICT` | Conflict (duplicate resource, concurrent update) |
| 500 | `HTTP_STATUS.INTERNAL_ERROR` | Unexpected server error |

### Return Type Conventions

**Create operations** return the created resource with HTTP 201:
- `createGroup` returns `GroupDTO`
- `createExpense` returns `ExpenseDTO`
- `createSettlement` returns `SettlementDTO`

**Read operations** return the requested data with HTTP 200:
- `listGroups` returns `ListGroupsResponse`
- `getGroupFullDetails` returns `GroupFullDetailsDTO`

**Update and delete operations** return HTTP 204 No Content (void):
- `updateGroup`, `deleteGroup`, `updateExpense`, `deleteExpense`, etc.
- The frontend re-fetches data when needed via `refreshAll()` patterns

This convention eliminates ambiguity about what update/delete endpoints return.

---

## Route Parameter Naming

Route parameters use resource-specific names consistently:

| Resource | Parameter |
|----------|-----------|
| Group | `:groupId` |
| Expense | `:expenseId` |
| Settlement | `:settlementId` |
| Policy | `:policyId` |
| User (admin) | `:userId` |
| Member | `:memberId` |

Never use generic `:id` - always use the resource-specific name.

---

## Authentication

### Middleware

Authentication middleware is defined in `firebase/functions/src/auth/middleware.ts`:

- **`authenticate`** - Verifies Firebase ID token from `Authorization: Bearer <token>` header. Attaches `req.user` with `{ uid, displayName, role }`.
- **`authenticateAdmin`** - Extends `authenticate`, additionally requires `role === 'system_admin'`. Returns 403 if lacking admin privileges.
- **`authenticateTenantAdmin`** - Requires `role === 'tenant_admin'` or `role === 'system_admin'`.

### Role Storage

User roles are stored in Firestore at `users/{userId}` with a required `role` field (see `SystemUserRoles` in `shared-types.ts`):

| Role | Constant | Access Level |
|------|----------|--------------|
| `'system_admin'` | `SystemUserRoles.SYSTEM_ADMIN` | Full admin access - can manage all users and system settings |
| `'tenant_admin'` | `SystemUserRoles.TENANT_ADMIN` | Tenant-scoped admin - can manage tenant branding and domains |
| `'system_user'` | `SystemUserRoles.SYSTEM_USER` | Regular user - default role, no admin access |

---

## Error Handling

### Error Response Format

All errors follow a single structured format:

```
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": { ... },        // Optional field-specific details
    "correlationId": "..."     // Optional request correlation ID
  }
}
```

### Standard Error Codes

The `Errors` factory in `firebase/functions/src/utils/errors.ts` provides standard errors:

| Factory | Code | HTTP Status | Usage |
|---------|------|-------------|-------|
| `Errors.UNAUTHORIZED()` | `UNAUTHORIZED` | 401 | Missing authentication |
| `Errors.INVALID_TOKEN()` | `INVALID_TOKEN` | 401 | Bad or expired token |
| `Errors.FORBIDDEN()` | `FORBIDDEN` | 403 | Insufficient permissions |
| `Errors.INVALID_INPUT(details)` | `INVALID_INPUT` | 400 | General validation failure |
| `Errors.MISSING_FIELD(field)` | `MISSING_FIELD` | 400 | Required field not provided |
| `Errors.NOT_FOUND(resource)` | `NOT_FOUND` | 404 | Resource doesn't exist |
| `Errors.ALREADY_EXISTS(resource)` | `ALREADY_EXISTS` | 409 | Duplicate resource |
| `Errors.CONCURRENT_UPDATE()` | `CONCURRENT_UPDATE` | 409 | Optimistic locking failure |

Additionally, `VALIDATION_ERROR` is returned by the Zod validation layer (via `createZodErrorMapper`) for field-specific schema validation failures.

### Validation Errors

Field-specific validation errors include details mapping field paths to error messages. See `docs/guides/validation.md` for the validation strategy.

### Error Propagation

Handlers should let errors bubble up to the centralized error handler. Avoid `try/catch` unless handling a specific recoverable case. The `ApiError` class carries status code, error code, and message through the stack.

---

## Request Validation

All request validation uses Zod schemas with the `createRequestValidator` pattern. See `docs/guides/validation.md` for details.

Key points:
- Schemas are defined in `packages/shared/src/schemas/` for shared contracts
- Handler-specific validation lives in `{module}/validation.ts` files
- Use `createZodErrorMapper` for field-specific error messages
- Query parameters are validated with explicit schemas, not silent defaults

---

## Response Validation

The frontend validates all API responses at runtime using Zod schemas from `packages/shared/src/schemas/apiSchemas.ts`.

The `responseSchemas` map associates endpoint patterns with their expected response schemas. This catches schema drift between backend and frontend during development.

---

## Type Safety

### Branded Types

The API uses branded types for identifiers to prevent mixing incompatible IDs:
- `GroupId`, `ExpenseId`, `SettlementId`, `UserId`, `PolicyId`
- `DisplayName`, `Email`, `ShareLinkToken`

See `packages/shared/src/shared-types.ts` for all branded type definitions.

### Request/Response Types

All request and response types must be defined in the shared package:
- Request types: `CreateGroupRequest`, `UpdateExpenseRequest`, etc.
- Response types: `GroupDTO`, `ListGroupsResponse`, `GroupFullDetailsDTO`, etc.

This ensures type consistency between client and server. See `docs/guides/types.md` for the type system architecture.

---

## Adding New Endpoints

When adding a new endpoint:

1. **Define the method signature** in the appropriate interface in `packages/shared/src/api.ts`
2. **Define request/response types** in `packages/shared/src/shared-types.ts`
3. **Add response schema** to `packages/shared/src/schemas/apiSchemas.ts`
4. **Create the handler** in the appropriate module under `firebase/functions/src/`
5. **Add validation** using `createRequestValidator` pattern
6. **Register the route** in `firebase/functions/src/routes/route-config.ts`
7. **Implement in all API drivers** (ApiClient, ApiDriver, AppDriver)

Follow existing patterns - examine similar endpoints for reference.

---

## Testing the API

### Unit Tests

Unit tests use `AppDriver` which calls handlers directly without HTTP, using the Firebase Simulator for in-memory Firestore. See `firebase/functions/src/__tests__/unit/AppDriver.ts`.

### Integration Tests

Integration tests use `ApiDriver` which makes real HTTP requests against the Firebase Emulator. See `packages/test-support/src/ApiDriver.ts`.

### Response Schema Tests

Schema validation tests in `packages/shared/src/__tests__/unit/api-schemas.test.ts` verify response schemas match actual endpoint responses.

---

## Quick Reference

**Creating a resource:** POST, return 201 with the created DTO

**Reading a resource:** GET, return 200 with the DTO or list response

**Updating a resource:** PUT/PATCH, return 204 No Content

**Deleting a resource:** DELETE, return 204 No Content

**Validation failure:** Return 400 with `VALIDATION_ERROR`, `INVALID_INPUT`, or `MISSING_FIELD`

**Not found:** Return 404 with `NOT_FOUND`

**Permission denied:** Return 403 with `FORBIDDEN`

**Unauthenticated:** Return 401 with `UNAUTHORIZED`
