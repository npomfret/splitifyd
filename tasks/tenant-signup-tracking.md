# Record Tenant on User Registration

## Status: COMPLETED

### Implementation Summary

All phases have been implemented and tested:

1. **Data Model Updates:**
   - Added `TenantIdSchema` to `firebase/functions/src/schemas/common.ts`
   - Added `signupTenantId` (optional) to `firebase/functions/src/schemas/user.ts`
   - Added `signupHostname` to `UserRegistration` interface and `RegisterRequestSchema`
   - Added `MISSING_SIGNUP_HOSTNAME` error code

2. **Backend Logic:**
   - Uses `HostResolver` class from `firebase/functions/src/utils/HostResolver.ts` for host validation
   - Updated register handler in `handlers.ts` to validate host and resolve tenant
   - Updated `UserService2.ts` to accept and store `signupTenantId`

3. **Frontend:**
   - Updated `apiClient.ts` to automatically add `signupHostname` from `window.location.hostname`

4. **Tests:**
   - Added registration tests in `firebase/functions/src/__tests__/unit/api/auth.test.ts`:
     - Successful registration
     - HOST_MISMATCH when signupHostname doesn't match request host
     - HOST_MISMATCH when host headers conflict
     - Fallback to default tenant for unknown hosts

**Note:** The TENANT_NOT_FOUND scenario only occurs when no default tenant is configured. The TenantRegistryService falls back to the default tenant for unknown hosts, which is expected behavior for white-label apps.

---

## Objective

Capture and store the tenant (`TenantId`) from which a user originates during the registration process. This is a data-collection task to enable future analytics and tenant-specific user management features. This task does not include building any features that consume this data.

---

## Proposed Implementation Plan

The implementation should resolve the tenant on the server using the request host (validated against forwarded headers/origin) and store the resolved `signupTenantId` on the user's Firestore document. Additionally, capture a `signupHostname` from the browser and require it to match the validated request host to detect spoofing.

### Trust Boundary (Required)

- `signupHostname` is untrusted user input. It is only used for **comparison** against the server-validated host and must never be used for tenant resolution.
- Tenant resolution must always use the server-validated host (request host + forwarded header/origin checks).

### Phase 1: Data Model and Type Updates

**1. Update User document schema:**
- **File:** `firebase/functions/src/schemas/user.ts`
- **Action:** Add `signupTenantId` field using the existing `TenantIdSchema` from shared package, marked optional for backward compatibility with existing users.
- **Note:** This field is server-only (not exposed in `UserProfile` or API responses). Only surface in admin endpoints if needed for analytics.
- **Expand/Contract:** Confirm backwards compatibility is required; keep the field optional and avoid any read-path assumptions. Backfill remains out of scope unless explicitly requested.

**2. Update shared request types:**
- **Files:** `packages/shared/src/shared-types.ts`, `packages/shared/src/schemas/apiRequests.ts`, `firebase/functions/src/auth/validation.ts`
- **Action:** Add `signupHostname` to `UserRegistration` and validate/sanitize it. Treat it as required for registration so the server can compare it to the request host.
- **Validation:** Validate in shared schema, then sanitize in the server validator (same patterns as other user-provided strings).

### Phase 2: Backend - User Creation Logic

**1. Resolve tenant in the register handler:**
- **Files:** `firebase/functions/src/ApplicationFactory.ts`, `firebase/functions/src/auth/handlers.ts`
- **Action:** In the `/register` handler, resolve and validate the host (reuse `AuthHandlers` host logic or extract it into a shared utility), compare it to `signupHostname` from the request body. On mismatch, return `Errors.invalidRequest(ErrorDetail.HOST_MISMATCH)` (already exists in ErrorCode.ts:107). Then resolve the tenant via `TenantRegistryService.resolveTenant({ host })` and pass `signupTenantId` into the registration service.
- **Error order:** Fail on `HOST_MISMATCH` before attempting tenant resolution so behavior is deterministic and avoids leaking tenant info.

**2. Update User Creation Service:**
- **File:** `firebase/functions/src/services/UserService2.ts`
- **Action:**
    - Extend the registration flow to accept a `signupTenantId` (server-provided).
    - When creating the user document in the `users` collection, include `signupTenantId`.
    - If tenant resolution fails, return `Errors.notFound('Tenant', ErrorDetail.TENANT_NOT_FOUND)` (already exists in ErrorCode.ts:68).

### Phase 3: Frontend - Pass Hostname on Signup

**1. Client changes:**
- **Files:** `webapp-v2/src/app/stores/auth-store.ts`, `webapp-v2/src/pages/RegisterPage.tsx`, `webapp-v2/src/app/apiClient.ts`
- **Action:** Capture `window.location.hostname` and include it as `signupHostname` in the registration request.

---

## Testing

### Backend (Critical Path)

**API Unit Tests** (`firebase/functions/src/__tests__/unit/api/`):
- Test successful registration captures `signupTenantId` on user document
- Test registration with mismatched `signupHostname` returns `HOST_MISMATCH` error
- Test registration from unknown host returns `TENANT_NOT_FOUND` error
- Test backward compatibility: existing users without `signupTenantId` continue to work
- Use builders for all request payloads; no manual object literals.
- Likely files to touch: registration-related tests under `firebase/functions/src/__tests__/unit/api/` (confirm exact file names during implementation).

**Service Unit Tests** (if host resolution is extracted to utility):
- Test host resolution from various header combinations
- Test host validation against tenant registry

---

## Key Files to Modify

| Layer | File | Purpose |
|---|---|---|
| **Shared Types** | `packages/shared/src/shared-types.ts` | Add `signupHostname` to `UserRegistration`; consider whether to expose `signupTenantId` beyond Firestore. |
| **Backend Schema**| `firebase/functions/src/schemas/user.ts` | Update `UserDocumentSchema` with the new field. |
| **Backend Logic** | `firebase/functions/src/ApplicationFactory.ts` | Resolve tenant from host and pass `signupTenantId` into registration flow. |
| **Backend Logic** | `firebase/functions/src/services/UserService2.ts` | Store `signupTenantId` on the user document. |
| **Frontend Logic**| `webapp-v2/src/pages/RegisterPage.tsx` | Only update if client-provided hostname is required. |
| **API Client** | `webapp-v2/src/app/apiClient.ts` | Only update if client-provided hostname is required. |

## Future Considerations

- **Invite Flow:** How should `signupTenantId` be determined when a user registers via an invite link sent from a different tenant? The tenant context could be derived from the group they are being invited to.
- **Data Backfill:** Decide if a backfill strategy is needed for existing users (e.g., based on their group memberships). This is out of scope for the initial implementation.
