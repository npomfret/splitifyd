# Firebase Security Hardening - Phase 2

Last reviewed: March 2025  
Owner: Platform Engineering

## Status Snapshot

| Issue | Area | Status | Notes |
| --- | --- | --- | --- |
| 1 | Registration abuse (rate limiting) | Open | `register` handler exposes registration without throttling or abuse detection (firebase/functions/src/auth/handlers.ts:5). No rate-limiting middleware or request counters exist. |
| 2 | Test endpoint guardrails | Done | Production traffic is blocked from `/test-pool/*` and `/test/user/*`, and the handlers enforce non-production plus token checks (firebase/functions/src/index.ts:305, firebase/functions/src/test/policy-handlers.ts:14). |
| 3 | Auth field duplication | Partially done | Email and photo URL are no longer written to Firestore, but `displayName` is still duplicated on create/update (firebase/functions/src/services/UserService2.ts:200,392). Schema still allows legacy email fields for backward compatibility. |
| 4 | Health and diagnostics endpoints | Open | `/health` is minimal, but `/status` and `/env` still leak environment variables, filesystem contents, and runtime details without auth (firebase/functions/src/index.ts:121,183). |
| 5 | Email enumeration hardening | Open | Registration still surfaces `auth/email-already-exists` via structured error responses (firebase/functions/src/services/UserService2.ts:435) and lacks constant-time failure paths. |
| 6 | Log sanitization | Open | `ContextualLoggerImpl` forwards arbitrary payload keys without redaction (firebase/functions/src/utils/contextual-logger.ts:32-61). No redaction helper exists. |
| 7 | Admin audit logging | Open | No audit logger, firestore collection, or rules for admin operations are present. |
| 8 | Security headers | Done | `applySecurityHeaders` now sets DNS prefetch, download options, cross-domain policy, and HSTS preload headers in production (firebase/functions/src/middleware/security-headers.ts:1-31). |
| 9 | Input sanitization audit | Needs review | Sanitizers exist for comments, groups, and expenses, but no recent audit confirms coverage for every write path. No automated test asserts sanitization is enforced. |

Legend: Done = implemented and verified, Partially done = partially mitigated, Needs review = requires validation, Open = work outstanding.

## Completed Work

- Phase 1 hardening remains in effect: every write flows through `FirestoreWriter` validation and the published security rules continue to enforce least privilege.
- Test endpoints and policy helpers are fenced off from production, closing the privilege-escalation risk identified in the January audit.
- Security headers now include DNS prefetch, download, and cross-domain protections, and HSTS is preloaded in production.
- Email addresses are sourced exclusively from Firebase Auth; Firestore no longer stores fresh copies and legacy documents are tolerated via optional schema fields.

## Outstanding Work

1. Implement registration throttling and abuse protection (Issue 1). Options include IP-based quotas, per-email lockouts, and exponential backoff responses.
2. Lock down `/status` and `/env` (Issue 4). Either require authenticated admins, or remove sensitive payloads (environment variables, filesystem listings, process identifiers).
3. Ship a registration flow that avoids leaking whether an email exists (Issue 5). Standardise error messaging and insert a minimum response delay.
4. Introduce log sanitisation (Issue 6). Add redaction for password, token, key, and bearer fields before forwarding payloads to Cloud Logging.
5. Create an audit logging service for admin actions (Issue 7) and enforce read/write rules for the backing collection.
6. Finish the input sanitisation audit (Issue 9). Document coverage, add regression tests, and close any gaps (group names, notification payloads, etc.).
7. Consider removing the remaining `displayName` duplication from Firestore (Issue 3 follow-up) once frontend dependencies are reviewed.

## Issue Details

### Issue 1 - Registration abuse (rate limiting)

- **Status:** Open  
- **Findings:** The `register` handler simply delegates to `UserService2.registerUser` (firebase/functions/src/auth/handlers.ts:5) with no attempt counters, cooldowns, or IP throttling. Translation strings include `rateLimitExceeded`, but no middleware produces that response.  
- **Actions:** Introduce lightweight throttling (per-IP and per-email) at the Express layer, add metrics for rejection counts, and ensure emulator/test bypasses are explicit.

### Issue 2 - Test endpoint guardrails

- **Status:** Done  
- **Evidence:** Production deployments short-circuit `/test-pool/*` and `/test/user/*` with a 404 (firebase/functions/src/index.ts:305-315). Inside non-production, handlers enforce `config.isProduction` checks and Firebase ID token verification (firebase/functions/src/test/policy-handlers.ts:14-76,108-170).  
- **Next:** Monitor logs for unexpected production access attempts and remove deprecated routes once E2E coverage moves to dedicated helpers.

### Issue 3 - Auth field duplication

- **Status:** Partially done  
- **Evidence:** `createUserDirect` omits email and photo URL when seeding Firestore (firebase/functions/src/services/UserService2.ts:389-413), and profile updates no longer persist `photoURL`. However, Firestore still stores `displayName` on both create and update (firebase/functions/src/services/UserService2.ts:200,392), keeping two sources of truth. Schema (`firebase/functions/src/schemas/user.ts:21`) still marks `email` optional for legacy data.  
- **Next:** Decide whether the app still needs `displayName` in Firestore. If not, remove writes, trim the schema, and backfill or ignore legacy values.

### Issue 4 - Health and diagnostics endpoints

- **Status:** Open  
- **Evidence:** `/health` now returns only aggregated service status via `sendHealthCheckResponse` (firebase/functions/src/index.ts:80-118). Nevertheless, `/status` (firebase/functions/src/index.ts:121-137) and `/env` (firebase/functions/src/index.ts:183-274) remain unauthenticated and leak environment variables, runtime metrics, and filesystem listings.  
- **Next:** Collapse `/status` and `/env` behind admin authentication, or remove sensitive fields. Add regression tests to confirm secrets never reach public responses.

### Issue 5 - Email enumeration hardening

- **Status:** Open  
- **Evidence:** The registration flow still emits conflict responses tied to `AuthErrors.EMAIL_EXISTS` (firebase/functions/src/services/UserService2.ts:435-437) and lacks any timing equalisation.  
- **Next:** Return a single generic error for registration failures, add a minimum response duration, and fuzz tests to ensure differential timing stays within tolerance.

### Issue 6 - Log sanitisation

- **Status:** Open  
- **Evidence:** `ContextualLoggerImpl.buildLogData` simply copies arbitrary keys into the log payload (firebase/functions/src/utils/contextual-logger.ts:32-61). No helper redacts passwords, tokens, or secrets before they reach Cloud Logging.  
- **Next:** Add recursive redaction for common sensitive keys, ensure error serialization honours the same rules, and add unit tests for the sanitiser.

### Issue 7 - Admin audit logging

- **Status:** Open  
- **Evidence:** The codebase lacks an `AuditLogger`, audit collection, or Firestore rule updates to record privileged operations. Policy management and admin promotion flows simply log to Cloud Logging.  
- **Next:** Implement an audit logging service, persist events to a restricted collection, and add rule coverage to ensure only system admins can read audit entries.

### Issue 8 - Security headers

- **Status:** Done  
- **Evidence:** `applySecurityHeaders` now appends DNS prefetch, download options, cross-domain policy, and HSTS preload headers (firebase/functions/src/middleware/security-headers.ts:1-31). Production CSP remains intact.  
- **Next:** Periodically review the CSP and permissions policy as new frontend features land.

### Issue 9 - Input sanitisation audit

- **Status:** Needs review  
- **Evidence:** Existing utilities sanitise comments, expenses, and group updates (for example `firebase/functions/src/comments/validation.ts:34-69` and `firebase/functions/src/expenses/validation.ts:120-135`), but there is no documented audit or automated test proving every write path applies sanitisation. Notifications, policy text, and admin tooling need confirmation.  
- **Next:** Catalogue all user-controlled fields, verify sanitisation is applied, and add regression tests where gaps are found.

## Phase 1 Reference (Data Layer Hardening)

- 100% of Firestore writes validated through `FirestoreWriter`.
- Production security rules enforce membership and role checks across collections.
- Transaction helpers perform selective validation and metrics logging.
- Direct Firestore writes were removed in favour of typed helpers.
- Monitoring hooks capture validation failures and bulk operations.

## Success Metrics

- No unauthorised access to test endpoints in production.
- No successful email enumeration attempts (manual probes plus automated tests).
- Sensitive values never appear in logs (validated by sampling).
- Admin actions generate audit log entries with actor, target, and outcome metadata.
- Health/status endpoints expose no secrets, even under failure conditions.
