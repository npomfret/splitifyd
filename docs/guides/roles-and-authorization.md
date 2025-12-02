# Roles and Authorization

## Role Definitions

Roles are defined in `packages/shared/src/shared-types.ts`:

| Role | Access |
|------|--------|
| `system_admin` | Full admin panel access, user management, tenant configuration |
| `tenant_admin` | Tenant configuration only (branding, domains) |
| `system_user` | Regular user, no admin access (default for new users) |

## How It Works

1. **Storage**: Roles are stored in Firestore at `users/{userId}.role`
2. **Authentication**: Middleware reads role from Firestore on each request
3. **Assignment**: New users get `system_user` by default

## Middleware

| Middleware | Required Role |
|------------|---------------|
| `authenticate` | Any authenticated user |
| `authenticateAdmin` | `system_admin` only |
| `authenticateTenantAdmin` | `tenant_admin` or `system_admin` |
| `authenticateSystemUser` | `system_user` or `system_admin` |

## Protected Routes

### System Admin Only (`authenticateAdmin`)
- `/admin/tenants/*` - Tenant management
- `/admin/policies/*` - Policy management
- `/admin/users/*` - User management
- `/env` - Environment diagnostics

### Tenant Admin (`authenticateTenantAdmin`)
- `/settings/tenant` - Get tenant settings
- `/settings/tenant/branding` - Update branding
- `/settings/tenant/domains` - Domain management

### Any System Role (`authenticateSystemUser`)
- `/admin/browser/users/auth` - List auth users
- `/admin/browser/users/firestore` - List Firestore users

## Frontend Access

| Page | Required Role |
|------|---------------|
| `/admin` | `system_admin` |
| `/settings/tenant/branding` | `tenant_admin` or `system_admin` |

## Key Files

| Purpose | Location |
|---------|----------|
| Role definitions | `packages/shared/src/shared-types.ts` |
| Authorization middleware | `firebase/functions/src/auth/middleware.ts` |
| Route configuration | `firebase/functions/src/routes/route-config.ts` |
| Role update API | `firebase/functions/src/admin/UserAdminHandlers.ts` |
| User creation | `firebase/functions/src/services/UserService2.ts` |
| Firestore role update | `firebase/functions/src/services/firestore/FirestoreWriter.ts` |
