# Roles and Authorization

Two independent role systems: **system roles** (global) and **group roles** (per-membership).

---

## System Roles

Stored at `users/{userId}.role`. Checked by auth middleware before handlers run.

| Role | Purpose |
|------|---------|
| `system_admin` | Full admin panel access |
| `tenant_admin` | Tenant branding/domains only |
| `system_user` | Regular user (default) |

**Middleware:** `authenticateAdmin` → requires `system_admin`. `authenticateTenantAdmin` → requires `tenant_admin` or higher.

---

## Group Roles

Stored at `groups/{groupId}/members/{userId}.memberRole`. Determines what a user can do in a specific group.

| Role | Capabilities |
|------|-------------|
| `admin` | Full group control (settings, members, all actions) |
| `member` | Participate based on group permission settings |
| `viewer` | Read-only (blocked from editing, deleting, inviting) |

**Member status** also matters: only `active` members can act. `pending` members await approval; `archived` members are hidden from their own view.

---

## Group Permission Settings

Each group has configurable permissions stored in `group.permissions`:

| Permission | Controls |
|------------|----------|
| `expenseEditing` | Who can create/edit expenses |
| `expenseDeletion` | Who can delete expenses |
| `memberInvitation` | Who can invite new members |
| `memberApproval` | `automatic` or `admin-required` |
| `settingsManagement` | Who can change group settings |

**Permission levels:**

| Level | Who can act |
|-------|-------------|
| `anyone` | All members (except viewers) |
| `owner-and-admin` | Admins + expense creator (for their own) |
| `admin-only` | Admins only |

**Presets:** `OPEN` (permissive defaults) and `MANAGED` (admin-controlled). See `permission-engine.ts`.

---

## Enforcement

### Server (authoritative)

All permission checks happen server-side. The client is never trusted.

| Check | Method | Used by |
|-------|--------|---------|
| System role | `authenticateAdmin()` middleware | Admin routes |
| Group admin | `GroupMemberService.ensureActiveGroupAdmin()` | Settings, role changes |
| Action permission | `PermissionEngineAsync.checkPermission()` | Expenses, settlements, invites |

**Flow:** Request → auth middleware (verify token, load system role) → handler → `getGroupAccessContext()` (load group + membership) → `checkPermission()` (evaluate action) → execute or 403.

### Client (UI only)

Client mirrors permission logic for UI visibility but enforces nothing.

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute` | Redirects unauthenticated users to login |
| `ClientPermissionEngine` | Mirrors server logic for button/tab visibility |
| `permissionsStore` | Reactive permission state via Preact Signals |

The client uses server error responses (403) as the source of truth.

---

## Key Files

| Purpose | Location |
|---------|----------|
| Role types | `packages/shared/src/shared-types.ts` → `SystemUserRoles`, `MemberRoles`, `PermissionLevels` |
| Auth middleware | `firebase/functions/src/auth/middleware.ts` |
| Group admin guard | `firebase/functions/src/services/GroupMemberService.ts` → `ensureActiveGroupAdmin()` |
| Permission engine | `firebase/functions/src/permissions/permission-engine-async.ts` |
| Client permission engine | `webapp-v2/src/app/stores/permissions-store.ts` |
| Auth store | `webapp-v2/src/app/stores/auth-store.ts` |
