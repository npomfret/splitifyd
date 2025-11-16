# Task: Role System Cleanup and Consolidation

## Status
- **Priority:** High
- **Complexity:** Medium
- **Estimated Effort:** 4-6 hours
- **Risk Level:** Medium (affects authentication/authorization)

## Background

The application currently has an inconsistent role storage system where roles are stored in TWO locations but only ONE is actually used:

1. **Firestore** (`users/{uid}.role`) - **ACTUALLY USED** for authorization
2. **Firebase Auth Custom Claims** (`customClaims.role`) - Set by admin API but **IGNORED** by middleware

This creates several problems:
- No synchronization between the two storage locations
- Admin role updates only modify custom claims (which aren't used)
- Confusion about which is the authoritative source
- Wasted Firebase Auth custom claims feature

See `docs/architecture/roles-and-authorization.md` for full analysis.

## Recommended Solution

**Option A: Consolidate to Firestore Only** (Recommended)

This is the safest option because:
- Matches current middleware implementation (no breaking changes)
- Simpler architecture with single source of truth
- No user migration needed
- Already working this way in production

## Tasks

### 1. Update Admin Role Management API

**File:** `firebase/functions/src/admin/UserAdminHandlers.ts`

**Current Code (line 173-175):**
```typescript
// Update user custom claims with new role
const customClaims = role ? { role } : {};
await this.authService.setCustomUserClaims(uid, customClaims);
```

**Change To:**
```typescript
// Update Firestore role instead of custom claims
await this.firestoreWriter.updateUser(uid, { role });
```

**Additional Changes:**
- Update logging to reflect Firestore update instead of custom claims
- Remove `setCustomUserClaims` call entirely
- Add Firestore update with proper error handling

**Tests to Update:**
- `firebase/functions/src/__tests__/integration/admin/user-admin.test.ts`
- Add test to verify Firestore role is updated
- Remove test expectations for custom claims

### 2. Remove Custom Claims from Auth Service

**Decision Point:** Should we remove the `setCustomUserClaims` method entirely or keep it for future use?

**Recommendation:** Keep the method in the interface but mark as unused:

**File:** `firebase/functions/src/services/auth/IAuthService.ts`

```typescript
/**
 * Set custom claims for a user
 * @deprecated Currently unused - roles are stored in Firestore instead
 * @param uid - Firebase user UID
 * @param customClaims - Custom claims object
 */
setCustomUserClaims(uid: string, customClaims: object): Promise<void>;
```

### 3. Fix SYSTEM_USER Admin Access Bug

**Problem:** Regular users (`SYSTEM_USER`) are incorrectly granted admin panel access.

**File:** `webapp-v2/src/pages/AdminPage.tsx` (line 21)

**Current Code:**
```typescript
const isSystemAdmin = user?.role === SystemUserRoles.SYSTEM_ADMIN ||
                      user?.role === SystemUserRoles.SYSTEM_USER;  // ⚠️ Bug!
```

**Change To:**
```typescript
const isSystemAdmin = user?.role === SystemUserRoles.SYSTEM_ADMIN;
```

**Files to Check:**
- Search codebase for other instances of `SYSTEM_USER` being treated as admin
- Verify all authorization checks are correct

### 4. Update AdminUsersTab to Show Only Firestore Role

**File:** `webapp-v2/src/components/admin/AdminUsersTab.tsx`

**Current:** Shows both "Auth Role" and "DB Role" columns

**Change To:**
- Remove dual role display
- Show single "Role" column from Firestore
- Remove unnecessary Firestore user fetching (only need auth users)
- Simplify the UI and remove confusion

**Code Changes:**
```typescript
// Remove this interface
interface UserWithFirestoreRole { ... }

// Simplify loadUsers to only fetch auth users
const loadUsers = async (pageToken?: string) => {
    const authResponse = await apiClient.listAuthUsers(query);
    users.value = authResponse.users ?? [];
    // No need to fetch Firestore users separately
};

// Update table to show single role column
<th>Role</th>
// ...
<td>
    <span class={getRoleBadgeClass(firestoreRole)}>
        {formatRole(firestoreRole)}
    </span>
</td>
```

**BUT WAIT:** The auth users list doesn't include Firestore roles!

**Better Solution:**
- Modify backend `listAuthUsers` endpoint to include Firestore role in response
- OR keep current dual-fetch approach but show single "Role" column
- The role shown should be from Firestore (the authoritative source)

### 5. Update Backend to Return Firestore Role in Auth Listing

**File:** `firebase/functions/src/browser/UserBrowserHandlers.ts`

**Current:** Returns auth user data with `customClaims` (unused)

**Enhancement:** Fetch and include Firestore role in response

```typescript
async listAuthUsers(req, res) {
    // After getting auth users
    const authUsers = result.users;

    // Fetch Firestore roles for all users
    const userDocs = await Promise.all(
        authUsers.map(u => this.firestoreReader.getUser(u.uid))
    );

    // Merge Firestore role into response
    const usersWithRoles = authUsers.map((authUser, i) => ({
        ...serializeUserRecord(authUser),
        role: userDocs[i]?.role ?? SystemUserRoles.SYSTEM_USER,
    }));

    res.json({ users: usersWithRoles, ... });
}
```

### 6. Documentation Updates

**File:** `docs/architecture/roles-and-authorization.md`

Update the document to reflect:
- ✅ Single source of truth: Firestore
- ❌ Custom claims: Not used
- Add "Implemented" status to recommended solution
- Update diagrams and code examples

### 7. Add Migration Notes (for future reference)

**File:** `docs/migrations/role-system-migration.md` (new)

Document:
- Date of migration
- What changed (custom claims → Firestore only)
- Any users affected
- Rollback procedure if needed

## Testing Checklist

### Unit Tests
- [ ] Update `UserAdminHandlers.test.ts` to verify Firestore update
- [ ] Remove custom claims expectations from tests
- [ ] Verify `promoteUserToAdmin` still works correctly

### Integration Tests
- [ ] Test admin role assignment via API
- [ ] Verify role is persisted in Firestore
- [ ] Verify updated role is reflected in authorization
- [ ] Test role removal (setting to null)

### Manual Testing
- [ ] Create new user → verify default role `system_user`
- [ ] Promote user to `system_admin` → verify admin panel access
- [ ] Demote user to `system_user` → verify admin access revoked
- [ ] Assign `tenant_admin` → verify tenant settings access
- [ ] Verify existing users retain their roles

### Frontend Testing
- [ ] Verify admin page access control
- [ ] Verify tenant admin features
- [ ] Verify role display in admin users tab
- [ ] Verify role change functionality

## Risk Assessment

### Low Risk
- Middleware already reads from Firestore only
- No change to authorization logic
- Existing users already have Firestore roles

### Medium Risk
- Admin API behavior changes (updates Firestore instead of custom claims)
- Need to verify all role assignment paths
- Frontend may show stale data if not updated correctly

### Mitigation
- Deploy during low-traffic period
- Monitor error rates after deployment
- Keep rollback plan ready
- Test thoroughly in staging first

## Rollback Plan

If issues are discovered after deployment:

1. **Revert Admin API changes:**
   ```typescript
   // Restore custom claims update
   await this.authService.setCustomUserClaims(uid, customClaims);
   ```

2. **No database rollback needed** - Firestore updates are additive

3. **Frontend rollback** - Revert AdminUsersTab changes if needed

## Future Considerations

### If We Want to Use Custom Claims Later

Would need to:
1. Migrate all Firestore roles to custom claims
2. Update middleware to read from `decodedToken.customClaims.role`
3. Remove role field from Firestore (or keep as cache)
4. Update all role assignment code

See `docs/architecture/roles-and-authorization.md` Option B for details.

### Performance Optimization

Current approach requires Firestore read on every authenticated request (middleware line 61-63).

**Optimization Options:**
1. Cache role in memory for short period (30-60 seconds)
2. Include role in ID token custom claims (would need migration)
3. Accept the extra read as acceptable cost for simplicity

## Dependencies

- Firebase Admin SDK
- Firestore
- Frontend admin components

## Acceptance Criteria

- [ ] Admin role updates modify Firestore, not custom claims
- [ ] `SYSTEM_USER` role does not grant admin access
- [ ] Admin users tab shows single role column (from Firestore)
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No authorization regressions
- [ ] Role management API works correctly

## Notes

- This task focuses on consolidating to Firestore only
- Custom claims support remains in codebase but unused
- Can revisit decision later if requirements change
- Current system already works this way; we're just making it consistent

## Related Issues

- Admin panel shows both "Auth Role" and "DB Role" causing confusion
- Role updates don't actually change authorization (they update wrong field)
- `SYSTEM_USER` incorrectly granted admin access in some places
