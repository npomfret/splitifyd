# Centralize Validation Plan

## Context
- Firebase Functions now standardise on Zod request validators across auth, expenses, settlements, policies, comments, and user flows after retiring the remaining Joi helpers.
- Common rules (email/password regex, amount/date validation, error-to-code mapping, sanitisation) have been centralised under `firebase/functions/src/validation/common`.
- The webapp already validates API responses through shared Zod schemas; the next step is to share request DTOs so both runtimes consume the same shapes.

## Goals
- Provide a single source of truth for request validation rules and error mapping.
- Remove duplicated regex/constants and bring consistent sanitisation and translation behaviour.
- Make it easier to extend validation (new fields, locales) without touching multiple files.
- Promote reusable request schemas so both server and client consume the same Zod definitions without duplicating effort.

## Non-Goals
- No immediate behaviour changes to validation logic (messages, error codes) unless explicitly documented.
- No changes to Firestore document validation (already centralised under Zod).
- No direct refactor of client-side code beyond updating imports once shared helpers move.

## Approach & Progress
1. **Decide Validation Direction**
   - ✅ Converge on Zod for request validation; rationale documented in `docs/guides/validation.md`.
2. **Extract Shared Primitives**
   - ✅ Created `firebase/functions/src/validation/common/` with base regex, schema builders, sanitiser re-export, and request validator helper.
   - ✅ Extend shared schemas with amount/date/pagination and common error mappers.
3. **Introduce Validation Factory**
   - ✅ Implemented `createRequestValidator` to centralise parse/transform/error handling.
4. **Domain-by-Domain Migration**
   - ✅ Auth (`firebase/functions/src/auth/validation.ts`, `firebase/functions/src/services/auth/auth-validation.ts`) now uses shared Zod helpers.
   - ✅ User profile/change-password validators migrated to shared Zod helpers.
   - ✅ Policies & Comments now consume shared primitives and pagination helpers.
   - ✅ Expenses & Settlements refactored to shared Zod helpers (amount/date schemas, unified error mapping, sanitisation).
5. **Optional Zod Convergence**
   - ✅ Evaluated lifting request schemas into `@splitifyd/shared`; concluded we should expose Zod builders that stay tree-shakeable and avoid Node-specific helpers for browser bundles.
   - ✅ Re-ran webapp audit (`rg "Joi"`, `rg "zod"`): no runtime Joi usage; Zod already centralised via `apiClient` + shared response schemas.
   - ✅ Draft the shared request-schema surface (`@splitifyd/shared/src/schemas/apiRequests.ts`) with clear layering between pure schema definitions and server-only transformers before moving consumers.
   - ✅ Firebase request validators now import the shared schemas, eliminating duplicate definitions in auth, expenses, settlements, comments, policies, and user flows.
6. **Documentation & Tooling**
   - ✅ Added first-pass validation strategy guide.
   - ✅ Updated `docs/firebase-api-surface.md` to reference the shared Zod validators instead of Joi.
   - ✅ Removed dead Joi helpers (`validation/validationSchemas.ts`) and refactored `utils/amount-validation.ts` to be Joi-free.
   - ✅ Removed Joi enforcement script after completing migration.

## Deliverables
- Shared validation utilities module under `firebase/functions/src/validation/`.
- Refactored domain validators importing shared primitives/factory.
- Updated documentation covering validation conventions and migration guidance.
- Regression test updates ensuring API validation behaviour remains intact.

## Risks & Mitigations
- **Behaviour drift**: Ensure snapshot tests capture current error codes/messages before refactors; compare diff after each step.
- **Shared-schema bloat**: When promoting request schemas to `@splitifyd/shared`, guard against pulling server-only utilities into the webapp bundle (keep Zod definitions side-effect free).
- **Timeline creep**: Allocate time-boxed spikes per domain to avoid indefinite migration; track progress in tasks board.

## Open Questions
- ✅ What layering should we use when exporting request schemas from `@splitifyd/shared` so that `createRequestValidator` (server-only) remains optional?  
  Resolved by exporting pure schema builders from the shared package while keeping `createRequestValidator` in Firebase-only utilities.
- ✅ Renamed localisation helper to `translateValidationError` while keeping the translation logic in the validation utilities.
- Do we need compatibility shims for any out-of-tree integrations that previously imported the Joi-specific helpers?
