# Roles and Authorization System

## Overview

The application uses a role-based access control (RBAC) system with three distinct user roles. However, there is a **critical architectural inconsistency** where roles are stored in two locations but only one is actually used for authorization.

## Role Definitions

Roles are defined in `packages/shared/src/shared-types.ts`:

```typescript
export const SystemUserRoles = {
    SYSTEM_ADMIN: 'system_admin',    // Full system access, can manage all users and tenants
    TENANT_ADMIN: 'tenant_admin',    // Can manage tenant configuration (branding, domains)
    SYSTEM_USER: 'system_user',      // Regular user with no admin privileges
} as const;

export type SystemUserRole = (typeof SystemUserRoles)[keyof typeof SystemUserRoles];
```

### Role Capabilities

| Role | Can Access Admin Panel | Can Manage Users | Can Configure Tenant | Can Use App Features |
|------|----------------------|------------------|---------------------|---------------------|
| `system_admin` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| `tenant_admin` | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| `system_user` | ❌ No | ❌ No | ❌ No | ✅ Yes |

**Note:** In some places in the code, `SYSTEM_USER` is treated as equivalent to `SYSTEM_ADMIN` (see AdminPage.tsx:21). This appears to be a bug.

## Current Architecture (Inconsistent - Needs Cleanup)

### Role Storage

**Roles are stored in TWO separate locations:**

1. **Firestore User Document** (PRIMARY - Actually Used)
   - Location: `users/{userId}` collection
   - Field: `role` (optional field)
   - Schema: `firebase/functions/src/schemas/user.ts`
   - **This is what the authentication middleware actually reads**

2. **Firebase Auth Custom Claims** (SECONDARY - Not Actually Used)
   - Set via: `auth.setCustomUserClaims(uid, { role: 'system_admin' })`
   - Included in: ID tokens
   - **Currently ignored by authorization middleware**

### Authorization Flow

```
┌─────────────────┐
│  Client Request │
│  (with ID token)│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  authenticate() middleware              │
│  firebase/functions/src/auth/middleware │
├─────────────────────────────────────────┤
│  1. Verify ID token                     │
│  2. Get Firebase Auth user record       │
│  3. ⚠️  Fetch role from FIRESTORE        │  ◄── Uses Firestore, NOT custom claims!
│  4. Attach to req.user                  │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Authorization Middleware               │
│  (requireAdmin, requireSystemUser, etc) │
├─────────────────────────────────────────┤
│  Check req.user.role value              │
│  Allow/deny based on role               │
└─────────────────────────────────────────┘
```

**Key Code Location:**
```typescript
// firebase/functions/src/auth/middleware.ts:60-69
async authenticate(req, res, next) {
    const decodedToken = await authService.verifyIdToken(token);
    const userRecord = await authService.getUser(decodedToken.uid);

    // CRITICAL: Reads from Firestore, NOT custom claims!
    const userDocument = await firestoreReader.getUser(userRecord.uid);
    const userRole = userDocument!.role;

    req.user = {
        uid: userRecord.uid,
        role: userRole,  // From Firestore
    };
}
```

### Critical Inconsistency

**The system maintains two separate role stores with NO synchronization:**

| Operation | Updates Firestore | Updates Custom Claims |
|-----------|------------------|----------------------|
| User Registration | ✅ Yes (`system_user`) | ❌ No |
| Admin Role Update API | ❌ No | ✅ Yes |
| Direct Firestore Promotion | ✅ Yes | ❌ No |
| Test Data Seeding | ✅ Yes | ❌ No |

**Result:** Roles in Firestore and Firebase Auth can easily become out of sync, with Firestore being the authoritative source.

## Role Assignment

### 1. New User Registration

**File:** `firebase/functions/src/services/UserService2.ts:479-520`

All new users are assigned `SYSTEM_USER` role by default:

```typescript
const userDoc: FirestoreUserCreateData = {
    role: SystemUserRoles.SYSTEM_USER,  // Default
    createdAt: now,
    updatedAt: now,
};
```

**Storage:**
- ✅ Firestore: `users/{uid}.role = 'system_user'`
- ❌ Firebase Auth custom claims: NOT SET

### 2. Admin Role Update

**Endpoint:** `PUT /admin/users/:uid/role`
**Handler:** `firebase/functions/src/admin/UserAdminHandlers.ts:117-225`

```typescript
async updateUserRole(req, res) {
    // Validate role
    const validRoles = Object.values(SystemUserRoles);
    if (role !== null && !validRoles.includes(role)) {
        throw new ApiError(400, 'INVALID_ROLE', 'Invalid role');
    }

    // Update Firebase Auth custom claims ONLY
    const customClaims = role ? { role } : {};
    await this.authService.setCustomUserClaims(uid, customClaims);

    // ⚠️  Does NOT update Firestore!
}
```

**Storage:**
- ❌ Firestore: NOT UPDATED (inconsistency!)
- ✅ Firebase Auth custom claims: Updated

### 3. Direct Firestore Promotion

**Method:** `firestoreWriter.promoteUserToAdmin(userId)`
**File:** `firebase/functions/src/services/firestore/FirestoreWriter.ts:645-649`

```typescript
async promoteUserToAdmin(userId: UserId): Promise<void> {
    await this.db.collection(FirestoreCollections.USERS).doc(userId).set({
        role: SystemUserRoles.SYSTEM_ADMIN,
    }, { merge: true });
}
```

**Storage:**
- ✅ Firestore: Updated
- ❌ Firebase Auth custom claims: NOT SET

## Authorization Checks

### Backend Middleware

**File:** `firebase/functions/src/auth/middleware.ts`

```typescript
// System Admin check (line 86)
const requireAdmin = async (req, res, next) => {
    if (req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
        sendError(res, Errors.FORBIDDEN(), correlationId);
        return;
    }
    next();
};

// System User check (line 103)
const requireSystemUser = async (req, res, next) => {
    if (!req.user ||
        (req.user.role !== SystemUserRoles.SYSTEM_ADMIN &&
         req.user.role !== SystemUserRoles.SYSTEM_USER)) {
        sendError(res, Errors.FORBIDDEN(), correlationId);
        return;
    }
    next();
};

// Tenant Admin check (line 138)
const requireTenantAdmin = async (req, res, next) => {
    if (req.user.role !== SystemUserRoles.TENANT_ADMIN &&
        req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
        sendError(res, Errors.FORBIDDEN(), correlationId);
        return;
    }
    next();
};
```

### Frontend Checks

**Admin Page Access:**
```typescript
// webapp-v2/src/pages/AdminPage.tsx:21-22
const isSystemAdmin = user?.role === SystemUserRoles.SYSTEM_ADMIN ||
                      user?.role === SystemUserRoles.SYSTEM_USER;  // ⚠️  Bug?
```

**Tenant Admin Features:**
```typescript
// webapp-v2/src/pages/TenantBrandingPage.tsx:45
const hasAdminAccess = user?.role === SystemUserRoles.TENANT_ADMIN ||
                       user?.role === SystemUserRoles.SYSTEM_ADMIN;
```

## Protected Routes

### API Endpoints

| Route | Middleware | Required Role |
|-------|-----------|---------------|
| `GET /admin/auth/users` | `authenticateAdmin` | `SYSTEM_ADMIN` |
| `GET /admin/firestore/users` | `authenticateAdmin` | `SYSTEM_ADMIN` |
| `PUT /admin/users/:uid` | `authenticateAdmin` | `SYSTEM_ADMIN` |
| `PUT /admin/users/:uid/role` | `authenticateAdmin` | `SYSTEM_ADMIN` |
| `GET /admin/tenants` | `authenticateSystemUser` | `SYSTEM_ADMIN` or `SYSTEM_USER` |
| `GET /settings/tenant` | `authenticateTenantAdmin` | `TENANT_ADMIN` or `SYSTEM_ADMIN` |
| `PUT /settings/tenant/branding` | `authenticateTenantAdmin` | `TENANT_ADMIN` or `SYSTEM_ADMIN` |

**Route Configuration:** `firebase/functions/src/routes/route-config.ts`

### Frontend Routes

| Route | Required Role |
|-------|---------------|
| `/admin` | `SYSTEM_ADMIN` or `SYSTEM_USER` (⚠️ bug?) |
| `/admin/tenants` | `SYSTEM_ADMIN` or `SYSTEM_USER` (⚠️ bug?) |
| `/settings/tenant/branding` | `TENANT_ADMIN` or `SYSTEM_ADMIN` |
| `/settings/tenant/domains` | `TENANT_ADMIN` or `SYSTEM_ADMIN` |
| `/browser/users` | `SYSTEM_ADMIN` |

## Known Issues

### 1. Dual Storage Without Synchronization

**Problem:** Roles are stored in both Firestore and Firebase Auth custom claims, but there's no mechanism to keep them in sync.

**Impact:**
- Admin role updates via API only update custom claims
- Authorization reads only from Firestore
- The two can easily become inconsistent

**Example Scenario:**
```
1. User created: Firestore role = 'system_user', Custom claims = (empty)
2. Admin promotes via API: Firestore role = 'system_user', Custom claims = 'system_admin'
3. Authorization check: User is denied admin access (reads from Firestore!)
```

### 2. Custom Claims Not Used

**Problem:** The admin API sets Firebase Auth custom claims, but the authentication middleware completely ignores them and reads from Firestore instead.

**Impact:**
- Wasted effort setting custom claims
- Confusion about which is the authoritative source
- Custom claims feature of Firebase Auth is unused

### 3. SYSTEM_USER Treated as SYSTEM_ADMIN

**Problem:** In several frontend locations, `SYSTEM_USER` is granted the same access as `SYSTEM_ADMIN`.

**Locations:**
- `webapp-v2/src/pages/AdminPage.tsx:21`
- Route middleware for `/admin/tenants`

**Impact:** Regular users might have unintended admin access.

### 4. No Role Migration Path

**Problem:** Existing users created before the role management system may have:
- Role in Firestore but not in custom claims
- No role at all (defaults to `system_user`)

**Impact:** Inconsistent user access across the system.

## Recommendations

### Option A: Use Firestore Only (Recommended)

**Pros:**
- Simpler architecture
- Matches current middleware implementation
- No migration needed (already working this way)

**Changes:**
1. Remove all `setCustomUserClaims()` calls
2. Update admin role API to modify Firestore instead
3. Document that Firestore is the single source of truth

**Implementation:**
```typescript
// In UserAdminHandlers.ts
async updateUserRole(req, res) {
    // Update Firestore instead of custom claims
    await this.firestoreWriter.updateUser(uid, { role });
}
```

### Option B: Use Firebase Auth Custom Claims Only

**Pros:**
- Leverages built-in Firebase feature
- Roles automatically included in ID tokens
- No extra Firestore read during authentication

**Cons:**
- Requires updating all existing users (migration)
- More complex to query users by role
- Requires middleware changes

**Changes:**
1. Update middleware to read from `decodedToken.customClaims.role`
2. Migrate existing Firestore roles to custom claims
3. Remove role field from Firestore schema
4. Update all role-setting code

**Implementation:**
```typescript
// In middleware.ts
async authenticate(req, res, next) {
    const decodedToken = await authService.verifyIdToken(token);

    // Read from custom claims instead of Firestore
    const userRole = decodedToken.role || SystemUserRoles.SYSTEM_USER;

    req.user = {
        uid: decodedToken.uid,
        role: userRole,
    };
}
```

### Option C: Synchronized Dual Storage

**Pros:**
- Best of both worlds
- Redundancy for safety

**Cons:**
- Most complex
- Must ensure synchronization always happens
- Risk of desynchronization bugs

**Not Recommended** - Adds complexity without clear benefit.

## Testing

### Test Data Generation

**File:** `firebase/functions/src/__tests__/unit/AppDriver.ts`

```typescript
// Seed admin user (Firestore only)
seedAdminUser(userId: UserId, userData: Record<string, any> = {}) {
    return this.db.seedUser(userId, {
        ...userData,
        role: SystemUserRoles.SYSTEM_ADMIN,
    });
}

// Seed tenant admin (Firestore only)
seedTenantAdminUser(userId: UserId, userData: Record<string, any> = {}) {
    return this.db.seedUser(userId, {
        ...userData,
        role: SystemUserRoles.TENANT_ADMIN,
    });
}
```

**Note:** Test data only sets Firestore roles, which matches how the middleware works.

## Migration Considerations

If switching from current system to either pure approach:

1. **Audit Existing Users:**
   ```sql
   -- Count users by role in Firestore
   SELECT role, COUNT(*) FROM users GROUP BY role;
   ```

2. **Identify Mismatches:**
   - Users with Firestore role but no custom claims
   - Users with custom claims but different Firestore role

3. **Migration Script:**
   - For Option A: Keep Firestore, clear custom claims
   - For Option B: Copy Firestore roles to custom claims, then remove from Firestore

## Related Files

### Core Implementation
- `packages/shared/src/shared-types.ts` - Role definitions
- `firebase/functions/src/auth/middleware.ts` - Authorization logic
- `firebase/functions/src/admin/UserAdminHandlers.ts` - Role management API
- `firebase/functions/src/services/UserService2.ts` - User creation with roles

### Frontend Authorization
- `webapp-v2/src/pages/AdminPage.tsx` - Admin panel access
- `webapp-v2/src/pages/TenantBrandingPage.tsx` - Tenant admin access
- `webapp-v2/src/pages/DomainManagementPage.tsx` - Tenant admin access
- `webapp-v2/src/components/admin/AdminUsersTab.tsx` - Role management UI

### Testing
- `firebase/functions/src/__tests__/unit/AppDriver.ts` - Test user seeding
- `firebase/functions/src/__tests__/unit/mocks/StubAuthService.ts` - Auth mocking
