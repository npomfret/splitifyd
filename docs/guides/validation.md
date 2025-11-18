# Validation Strategy

## Overview
- Runtime validation protects Firebase Functions from malformed input and keeps the webapp aligned with server contracts.
- The codebase now relies solely on **Zod** for request validation, DTO parsing, and client response checks; legacy **Joi** helpers have been removed.
- Shared primitives (regex, sanitisation, error mapping) live under `firebase/functions/src/validation/common` to keep behaviour consistent and eliminate duplication.

## Direction
- **Zod is canonical** for all runtime validation.
  - Shared DTO schemas remain in `@billsplit/shared`; request validators live in Firebase functions until the shared surface is formalised.
  - `parseWithApiError` + monitoring hooks assume Zod issues, so inputs should always be parsed via the shared helpers.
- **Future shared surface**: design an `@billsplit/shared/src/schemas/apiRequests.ts` module to host request DTOs consumed by both client and server once request/response contracts stabilise.

## Implementation Principles
1. Preserve current error codes/messages; snapshot before/after where possible.
2. Keep shared primitives (email/password regex, amount/date schemas, sanitisation) in the common module to avoid divergence.
3. Build request validators with `createRequestValidator` so that parsing, sanitisation, and error mapping remain consistent.
4. Update unit tests to cover both happy-path parsing and error translation.
5. When promoting schemas to `@billsplit/shared`, ensure they remain tree-shakeable and safe for both Node and browser runtimes.

## Completed Phases
1. ✅ **Scaffolding**  
   - Created `firebase/functions/src/validation/common/` for shared regex, sanitisation, and typed error helpers.  
   - Exposed `createRequestValidator` utility that wraps `parseWithApiError` for request contexts.
2. ✅ **Auth & User**  
   - Converted `auth/validation.ts` and `services/auth/auth-validation.ts` to Zod schemas.  
   - Shared regex + display name schema via common module.
3. ✅ **Policies & Comments**  
   - Ported request schemas, reusing group/expense ID validators from shared code.  
   - Ensured sanitisation remains identical (policy text untouched).
4. ✅ **Expenses & Settlements**  
   - Introduced shared money/date schemas; aligned error mapping with existing behaviour.  
   - Validated precision using common helper.
5. ✅ **Cleanup**  
   - Removed remaining Joi imports and transitional adapters.  
   - Updated documentation/tests to reflect Zod-only validation pipeline.
   - Renamed localisation helper to `translateValidationError` while keeping Zod-focused behaviour intact.

## Next Steps
- Design and expose shared request schemas via `@billsplit/shared` once API contracts stabilise, enabling client/server reuse.
- Backfill unit coverage for the new validators (auth, policies, expenses, settlements) to lock in error-code parity.
