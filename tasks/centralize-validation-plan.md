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

## Approach
1. **Decide Validation Direction**
   - Choose between standardising on Joi (with shared primitives) or converging on Zod for request validation.
   - Capture decision in `docs/guides/validation.md` (new) and log trade-offs (runtime cost, TypeScript support, i18n).
2. **Extract Shared Primitives**
   - Create `firebase/functions/src/validation/common` with:
     - `regex.ts` (email, password, phone).
     - `schemas.ts` (displayName, amount, date, note, pagination) implemented once and exported for reuse.
     - `errors.ts` housing reusable helpers to map Joi/Zod issues to `ApiError` codes/messages.
     - `sanitizers.ts` consolidating string trimming/XSS handling.
3. **Introduce Validation Factory**
   - Build a helper (e.g., `createValidator({ schema, errorMap, sanitize })`) that wraps Joi validation, normalises output, strips unknown fields, applies sanitisation, and throws consistent `ApiError`.
   - Update existing modules incrementally to use the factory instead of local `schema.validate` blocks.
4. **Domain-by-Domain Migration**
   - Phase refactors to minimise risk:
     1. Auth (`firebase/functions/src/auth/validation.ts`, `/services/auth/auth-validation.ts`).
     2. Users, Policies, Comments.
     3. Expenses & Settlements (more complex dependencies on amount/date helpers).
   - After each phase, run targeted unit/integration tests plus linting.
5. **Optional Zod Convergence**
   - If the decision favours Zod, expose request schemas from `@splitifyd/shared`, wrap Joi schemas as temporary adapters, and progressively replace Joi consumers.
   - Ensure `parseWithApiError` supports the new schemas and that `translateJoiError` is renamed/updated to handle the shared error shape.
6. **Documentation & Tooling**
   - Update developer docs (Code Guidelines, Testing) with new validation workflow.
   - Add lint rule or codemod guardrails to prevent ad-hoc `Joi.object` usage outside the shared module.

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
