# Firebase Security Hardening - Phase 2

Last reviewed: October 2025  
Owner: Platform Engineering

## Status Snapshot

| Issue | Area | Status | Notes |
| --- | --- | --- | --- |
| 1 | Registration abuse (edge-level control) | Delegated | Registration rate limiting must be enforced before traffic reaches Cloud Functions. No function-level throttling is planned; coordinate with the platform gateway team. |
| 3 | Auth field duplication | Partially done | Email and photo URL are no longer written to Firestore, but `displayName` is still duplicated on create/update (firebase/functions/src/services/UserService2.ts:212,401). Schema still allows legacy email fields for backward compatibility (firebase/functions/src/schemas/user.ts:27). |
| 4 | Health and diagnostics endpoints | Done | `/env` now requires system-level roles via `authenticateSystemUser` and returns merged diagnostics including former `/status` payloads (firebase/functions/src/index.ts:83-90, firebase/functions/src/endpoints/diagnostics.ts:80-129). |
| 5 | Email enumeration hardening | Open | Registration still surfaces `auth/email-already-exists` via structured error responses (firebase/functions/src/services/UserService2.ts:443) and lacks constant-time failure paths. |
| 6 | Log sanitization | Open | `ContextualLoggerImpl` forwards arbitrary payload keys without redaction (firebase/functions/src/utils/contextual-logger.ts:32-118). No redaction helper exists. |
| 7 | Admin audit logging | Open | No audit logger, firestore collection, or rules for admin operations are present. |
| 9 | Input sanitization audit | Needs review | Sanitizers exist for comments, groups, and expenses, but no recent audit confirms coverage for every write path. No automated test asserts sanitization is enforced. |

Legend: Done = implemented and verified, Partially done = partially mitigated, Needs review = requires validation, Open = work outstanding.

## Outstanding Work

1. Ship a registration flow that avoids leaking whether an email exists (Issue 5). Standardise error messaging and insert a minimum response delay.
2. Introduce log sanitisation (Issue 6). Add redaction for password, token, key, and bearer fields before forwarding payloads to Cloud Logging.
3. Create an audit logging service for admin actions (Issue 7) and enforce read/write rules for the backing collection.
4. Finish the input sanitisation audit (Issue 9). Document coverage, add regression tests, and close any gaps (group names, notification payloads, etc.).
5. Consider removing the remaining `displayName` duplication from Firestore (Issue 3 follow-up) once frontend dependencies are reviewed.

## Issue Details

### Issue 1 - Registration abuse (edge-level control)

- **Status:** Delegated  
- **Findings:** The registration flow intentionally skips rate limiting because Cloud Functions is not the right enforcement point. Upstream services (load balancer, API gateway, or WAF) must handle quotas, lockouts, and CAPTCHA flows.  
- **Actions:** Coordinate with the platform team to confirm edge protections are in place; no changes required inside `firebase/functions`.

### Issue 3 - Auth field duplication

- **Status:** Partially done  
- **Evidence:** `createUserDirect` omits email and photo URL when seeding Firestore (firebase/functions/src/services/UserService2.ts:399-421), and profile updates no longer persist `photoURL`. However, Firestore still stores `displayName` on both create and update (firebase/functions/src/services/UserService2.ts:212,401), keeping two sources of truth. Schema (`firebase/functions/src/schemas/user.ts:27`) still marks `email` optional for legacy data.  
- **Next:** Decide whether the app still needs `displayName` in Firestore. If not, remove writes, trim the schema, and backfill or ignore legacy values.

### Issue 4 - Health and diagnostics endpoints

- **Status:** Done  
- **Evidence:** `/env` is the single diagnostics endpoint, now protected by `authenticateSystemUser` and enriched with the former `/status` metrics (firebase/functions/src/index.ts:83-90, firebase/functions/src/endpoints/diagnostics.ts:80-129). Integration tests assert unauthorised requests are rejected and that privileged responses contain no sensitive data.  
- **Next:** Maintain regression coverage ensuring non-system roles receive authorization errors and that diagnostics output stays bounded to approved fields.

### Issue 5 - Email enumeration hardening

- **Status:** Open  
- **Evidence:** The registration flow still emits conflict responses tied to `AuthErrors.EMAIL_EXISTS` (firebase/functions/src/services/UserService2.ts:441-444) and lacks any timing equalisation.  
- **Next:** Return a single generic error for registration failures, add a minimum response duration, and fuzz tests to ensure differential timing stays within tolerance.

### Issue 6 - Log sanitisation

- **Status:** Open  
- **Evidence:** `ContextualLoggerImpl.buildLogData` simply copies arbitrary keys into the log payload (firebase/functions/src/utils/contextual-logger.ts:32-118). No helper redacts passwords, tokens, or secrets before they reach Cloud Logging.  
- **Next:** Add recursive redaction for common sensitive keys, ensure error serialization honours the same rules, and add unit tests for the sanitiser.

### Issue 7 - Admin audit logging

- **Status:** Open  
- **Evidence:** The codebase lacks an `AuditLogger`, audit collection, or Firestore rule updates to record privileged operations. Policy management and admin promotion flows simply log to Cloud Logging.  
- **Next:** Implement an audit logging service, persist events to a restricted collection, and add rule coverage to ensure only system admins can read audit entries.

### Issue 9 - Input sanitisation audit

- **Status:** Needs review  
- **Evidence:** Existing utilities sanitise comments, expenses, and group updates (for example `firebase/functions/src/comments/validation.ts:35-85` and `firebase/functions/src/expenses/validation.ts:120-135`), but there is no documented audit or automated test proving every write path applies sanitisation. Notifications, policy text, and admin tooling need confirmation.  
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
- Health/diagnostics endpoints expose no secrets, even under failure conditions.
