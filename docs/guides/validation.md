# Validation Strategy

## Overview
- Runtime validation protects Firebase Functions from malformed input and keeps the webapp aligned with server contracts.
- The codebase currently uses **Joi** for request validation in several handlers and **Zod** for DTO/Firestore validation plus client response checks.
- Maintaining both stacks increases duplication (regex, sanitisation, error mapping) and complicates i18n/error localisation.

## Direction
- **Standardise on Zod** for new and migrated request validators.
  - Shared package already exposes DTO schemas (`@splitifyd/shared`).
  - `parseWithApiError` + `validation-monitor` infrastructure relies on Zod.
  - Allows single source of truth for client/server schemas.
- **Transitional support**: keep existing Joi validators functional while their logic is ported to Zod equivalents.
  - Provide adapters to wrap Zod schemas when handlers still expect Joi-style helpers.
  - De-duplicate regex/sanitisation/error helpers during migration to avoid behaviour drift.

## Migration Principles
1. Preserve current error codes/messages; snapshot before/after where possible.
2. Centralise shared primitives (email/password regex, amount/date schemas, sanitisation).
3. Port request validators domain by domain, replacing Joi usage with Zod + `parseWithApiError`.
4. Update unit tests to cover both happy-path parsing and error translation.
5. Remove deprecated Joi helpers once all consumers migrate.

## Phases
1. **Scaffolding**  
   - Create `firebase/functions/src/validation/common/` for shared regex, sanitisation, and typed error helpers.  
   - Expose `createRequestValidator` utility that wraps `parseWithApiError` for request contexts.
2. **Auth & User**  
   - Convert `auth/validation.ts` and `services/auth/auth-validation.ts` to Zod schemas.  
   - Share regex + display name schema via common module.
3. **Policies & Comments**  
   - Port request schemas, reuse group/expense ID validators from shared code.  
   - Ensure sanitisation remains identical (policy text untouched).
4. **Expenses & Settlements**  
   - Introduce shared money/date schemas; align error mapping with existing behaviour.  
   - Validate precision using common helper.
5. **Cleanup**  
   - Remove remaining Joi imports; deprecate or delete transitional adapters.  
   - Update documentation/tests to reflect Zod-only validation pipeline.

## Open Items
- Ensure localisation utilities (`translateJoiError`) accept the new common error shape; rename once Joi removed.
- Decide on lint rule/codemod to block new Joi usage (`rg "import .*joi"` should fail CI).
- Communicate migration timeline in engineering stand-up and tracking board.
