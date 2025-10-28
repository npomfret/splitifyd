# Centralize Validation Plan

## Context
- Firebase Functions currently mix Joi request validators (auth, expenses, settlements, policies, comments, user) with Zod schemas (groups, shared DTOs, Firestore documents).
- Common rules (email/password regex, amount/date validation, error-to-code mapping, sanitisation) are duplicated across modules, which drives drift and inconsistent API responses.
- The webapp validates API responses through shared Zod schemas; aligning request validation with the same source of truth would reduce mismatches between client expectations and server enforcement.

## Goals
- Provide a single source of truth for request validation rules and error mapping.
- Remove duplicated regex/constants and bring consistent sanitisation and translation behaviour.
- Make it easier to extend validation (new fields, locales) without touching multiple files.
- Prepare the codebase for eventual Joi → Zod migration (if adopted) without breaking current behaviour.

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
   - ☐ Evaluate moving remaining request schemas into `@splitifyd/shared` once migrations complete.
   - ✅ Re-ran webapp audit: no runtime Joi usage; Zod already centralised via `apiClient` + shared response schemas.
   - ☐ Design shared request-schema surface (likely under `@splitifyd/shared/src/schemas/apiRequests.ts`) so both server and Firebase functions share DTO definitions post-migration.
6. **Documentation & Tooling**
   - ✅ Added first-pass validation strategy guide.
   - ☐ Introduce lint/codemod guardrails against new Joi usage; update developer docs after next migrations.
   - ☐ Update `docs/firebase-api-surface.md` and any remaining references that still describe Joi validators.
   - ☐ Remove dead Joi helpers (e.g. `createJoiAmountSchema`) once downstream modules stop importing them.

## Deliverables
- Shared validation utilities module under `firebase/functions/src/validation/`.
- Refactored domain validators importing shared primitives/factory.
- Updated documentation covering validation conventions and migration guidance.
- Regression test updates ensuring API validation behaviour remains intact.

## Risks & Mitigations
- **Behaviour drift**: Ensure snapshot tests capture current error codes/messages before refactors; compare diff after each step.
- **Mixed validator ecosystems**: Provide interop helpers (Joi ⇄ Zod) until all callers converge on the chosen library.
- **Timeline creep**: Allocate time-boxed spikes per domain to avoid indefinite migration; track progress in tasks board.

## Open Questions
- Do we want DTO validation (shared package) to remain the canonical schema for both request/response?
- Should i18n error translation move entirely to Zod utilities, or do we extend localisation support for Joi errors?
- Are there external consumers (scripts, tests) relying on the current Joi-only exports that need backward compatibility adapters?
