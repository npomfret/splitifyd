# Validation Strategy

## Philosophy

**Fail fast, fail explicitly.** Invalid input should immediately throw structured errors rather than silently defaulting or continuing with bad data. This surfaces bugs early and provides clear feedback to API consumers.

**Single source of truth.** Zod schemas define validation rules once. The same schema validates input, derives TypeScript types, and documents the contract.

**Explicit errors over silent defaults.** Query parameters like `?limit=abc` throw `INVALID_QUERY_PARAMS` rather than silently using a default value. This makes debugging easier and contracts clearer.

## Architecture

```
@billsplit-wl/shared/src/schemas/
├── schemas/apiRequests.ts    # Request schemas (pagination, comments, activity feed)
├── schemas/apiSchemas.ts     # Response schemas for API contract validation

firebase/functions/src/
├── validation/common/
│   ├── request-validator.ts   # createRequestValidator() factory
│   ├── errors.ts              # createZodErrorMapper() for error translation
│   └── ...                    # Shared sanitization, regex, primitives
├── {module}/validation.ts     # Module-specific validators
└── schemas/                   # Backend-only schemas (tenant, etc.)
```

**Shared schemas** live in `@billsplit-wl/shared` and are consumed by both frontend and backend.

**Module validators** live alongside handler code and compose shared schemas with error mapping.

## Key Patterns

### Request Validation

All request validation uses `createRequestValidator()` which provides:
- Schema parsing with Zod
- Pre-validation normalization (e.g., `payload ?? {}`)
- Post-parse transformation (e.g., sanitization, type branding)
- Custom error mapping to domain-specific error codes

**Example files:**
- `firebase/functions/src/comments/validation.ts` - Query + body validation
- `firebase/functions/src/groups/validation.ts` - Request body with sanitization
- `firebase/functions/src/activity/ActivityHandlers.ts` - Inline query validation

### Error Mapping

`createZodErrorMapper()` translates Zod validation errors to API-friendly responses:
- Maps field paths to domain-specific error codes
- Supports custom error messages per field
- Falls back to sensible defaults

### Pagination

`createPaginationSchema()` provides reusable pagination validation with configurable limits:
- `ActivityFeedQuerySchema` - Default 10, max 100
- `ListCommentsQuerySchema` - Default 8, max 100

### Response Validation

Backend responses are validated against schemas before sending (see `middleware.ts`). Invalid responses return 500 `RESPONSE_VALIDATION_FAILED` in strict mode.

## Adding New Validators

1. **Define schema** in appropriate location:
   - Shared contract → `@billsplit-wl/shared/src/schemas/apiRequests.ts`
   - Backend-only → `firebase/functions/src/schemas/`

2. **Create error mapper** with domain-specific error codes

3. **Create validator** using `createRequestValidator()`

4. **Use in handler** to validate `req.body`, `req.params`, or `req.query`

## Key Files Reference

| File | Purpose |
|------|---------|
| `validation/common/request-validator.ts` | `createRequestValidator()` factory |
| `validation/common/errors.ts` | `createZodErrorMapper()` and error utilities |
| `comments/validation.ts` | Complete example with query + body validation |
| `groups/validation.ts` | Example with sanitization transforms |
| `schemas/apiRequests.ts` (shared) | Pagination schemas, request DTOs |
| `schemas/apiSchemas.ts` (shared) | Response schemas for contract validation |
