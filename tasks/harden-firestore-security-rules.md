# Firebase Security Hardening - Phase 2

Last reviewed: October 2025  
Owner: Platform Engineering

## Status Snapshot

| Issue | Area | Status | Notes |
| --- | --- | --- | --- |
| 1 | Registration abuse (edge-level control) | Delegated | Registration rate limiting must be enforced before traffic reaches Cloud Functions. No function-level throttling is planned; coordinate with the platform gateway team. |
| 3 | Auth field duplication | Done | Email, photo URL, and display name now live solely in Firebase Auth. Firestore writes omit `displayName`, and the user document schema no longer permits it (firebase/functions/src/services/UserService2.ts:200-229,449-499; firebase/functions/src/schemas/user.ts:27-60). |
| 4 | Health and diagnostics endpoints | Done | `/env` now requires system-level roles via `authenticateSystemUser` and returns merged diagnostics including former `/status` payloads (firebase/functions/src/index.ts:83-90, firebase/functions/src/endpoints/diagnostics.ts:80-129). |
| 5 | Email enumeration hardening | Done | Registration now enforces a minimum 600 ms response window with generic `REGISTRATION_FAILED` errors to avoid email enumeration leaks (firebase/functions/src/services/UserService2.ts:361-499, firebase/functions/src/utils/timing.ts:1-45). |
| 9 | Input sanitisation audit | Done | Audit completed; see docs/reports/input-sanitisation-audit.md. Regression tests cover sanitised writes for comments, expenses, groups, settlements, and user profile updates. |

Legend: Done = implemented and verified, Partially done = partially mitigated, Needs review = requires validation, Open = work outstanding.

## Outstanding Work

None at this time.


## Issue Details

### Issue 1 - Registration abuse (edge-level control)

- **Status:** Delegated  
- **Findings:** The registration flow intentionally skips rate limiting because Cloud Functions is not the right enforcement point. Upstream services (load balancer, API gateway, or WAF) must handle quotas, lockouts, and CAPTCHA flows.  
- **Actions:** Coordinate with the platform team to confirm edge protections are in place; no changes required inside `firebase/functions`.

### Issue 3 - Auth field duplication

- **Status:** Done  
- **Evidence:** User profile writes now rely on Firebase Auth exclusively for display names. Firestore writer helpers refuse `displayName` fields, and the user document schema no longer accepts it (firebase/functions/src/services/UserService2.ts:200-229,449-499; firebase/functions/src/services/firestore/FirestoreWriter.ts:587-646; firebase/functions/src/schemas/user.ts:27-60).  
- **Next:** None. Monitor for legacy documents if historical backfills are introduced.

### Issue 4 - Health and diagnostics endpoints

- **Status:** Done  
- **Evidence:** `/env` is the single diagnostics endpoint, now protected by `authenticateSystemUser` and enriched with the former `/status` metrics (firebase/functions/src/index.ts:83-90, firebase/functions/src/endpoints/diagnostics.ts:80-129). Integration tests assert unauthorised requests are rejected and that privileged responses contain no sensitive data.  
- **Next:** Maintain regression coverage ensuring non-system roles receive authorization errors and that diagnostics output stays bounded to approved fields.

### Issue 5 - Email enumeration hardening

- **Status:** Done  
- **Evidence:** `UserService.registerUser` now wraps registration in `withMinimumDuration` to guarantee at least 600 ms per attempt and maps Firebase duplicate-email responses to a generic `REGISTRATION_FAILED` payload (firebase/functions/src/services/UserService2.ts:361-499, firebase/functions/src/utils/timing.ts:1-45). Playwright registration specs and unit tests assert the new message and timing behaviour.  
- **Next:** Monitor telemetry for abnormal latency deviations; add timing fuzz tests if future regressions appear.

### Issue 9 - Input sanitisation audit

- **Status:** Done  
- **Evidence:** Group membership display name updates now sanitise input before validation (firebase/functions/src/groups/validation.ts:53-66), settlement create/update paths scrub note fields (firebase/functions/src/settlements/SettlementHandlers.ts:21-76), and audit results are captured in docs/reports/input-sanitisation-audit.md. Unit tests exercise the sanitisation defences (firebase/functions/src/__tests__/unit/groups/GroupHandlers.test.ts:287-306 and firebase/functions/src/__tests__/unit/settlements/SettlementHandlers.test.ts:32-83).  
- **Next:** Monitor future write surfaces when adding features and keep the audit document current.

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
