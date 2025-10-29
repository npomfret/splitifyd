# Task: User Browser - Disable/Enable Account Feature

Last created: October 2025
Owner: Platform Engineering

## Focus

Add the ability to disable and enable user accounts directly from the User Browser interface. This allows system administrators to quickly block access for problematic accounts without deleting user data.

## Context

The User Browser (webapp-v2/src/pages/browser/UsersBrowserPage.tsx) displays Firebase Auth users with their current status (Active/Disabled). Currently, admins can view user status but cannot change it through the UI. They must use Firebase Console or CLI tools instead.

Firebase Auth's `disabled` field controls whether a user can sign in:
- `disabled: true` - User cannot authenticate (blocked)
- `disabled: false` - User can authenticate normally (active)

## Current State

**Frontend:**
- User Browser shows current status in the Auth table (src/pages/browser/UsersBrowserPage.tsx:506-508)
- Green "Active" badge for enabled accounts
- Red "Disabled" badge for disabled accounts
- No button to change status

**Backend:**
- IAuthService interface has `updateUser()` method (firebase/functions/src/services/auth/IAuthService.ts)
- FirebaseAuthService implements `updateUser()` which can set the `disabled` field
- No HTTP endpoint exposed for admin user updates

## Implementation Plan

### 1. Backend - Add Admin Endpoint for User Updates

**Create new endpoint:**
- Path: `PUT /admin/users/:uid`
- Auth: Require `authenticateSystemAdmin` middleware (only system admin, not system user)
- Payload: `{ disabled: boolean }`
- Implementation:
  - Validate UID format
  - Validate payload contains only allowed fields (`disabled`)
  - Call `authService.updateUser(uid, { disabled })`
  - Return updated user record
  - Log admin action with actor UID and target UID

**Files to modify:**
- `firebase/functions/src/index.ts` - Add route
- `firebase/functions/src/admin/UserAdminHandlers.ts` (new file) - Handler implementation
- `firebase/functions/src/services/auth/IAuthService.ts` - Already has `updateUser()`, may need to add validation

**Error handling:**
- 400 Bad Request - Invalid UID or payload
- 403 Forbidden - Not system admin
- 404 Not Found - User doesn't exist
- 409 Conflict - Cannot disable your own account

### 2. Frontend - Add API Client Method

**Add to apiClient:**
```typescript
async updateUser(uid: string, updates: { disabled: boolean }): Promise<UserRecord> {
    return this.request({
        endpoint: `/admin/users/${uid}`,
        method: 'PUT',
        body: updates,
        schema: AuthUserSchema, // Reuse existing schema
    });
}
```

**Files to modify:**
- `webapp-v2/src/app/apiClient.ts`

### 3. Frontend - Add Disable/Enable Button

**Add button to Auth table:**
- Position: In the actions column next to "View JSON" button
- Text: "Disable" or "Enable" (dynamic based on current status)
- Variant: "danger" for disable, "secondary" for enable
- Confirmation: Show confirmation dialog before changing status
- Prevent self-disable: Check if UID matches current user, show error if attempting to disable own account
- Reload on success: Call `loadAuthUsers()` to refresh the table

**Implementation details:**
- Add `disablingUser` signal to track loading state per-user
- Add `handleDisableUser(uid, currentlyDisabled)` handler
- Use `window.confirm()` for now (could enhance with custom modal later)
- Show success/error messages

**Files to modify:**
- `webapp-v2/src/pages/browser/UsersBrowserPage.tsx` (lines ~512-518)

**Translation keys to add:**
```json
{
  "usersBrowser": {
    "disableUser": "Disable",
    "enableUser": "Enable",
    "disableUserConfirm": "Are you sure you want to disable this account? The user will be immediately signed out and unable to sign in until re-enabled.",
    "enableUserConfirm": "Are you sure you want to enable this account? The user will be able to sign in again.",
    "disableSuccess": "User disabled successfully",
    "enableSuccess": "User enabled successfully",
    "cannotDisableSelf": "You cannot disable your own account",
    "disableError": "Failed to disable user",
    "enableError": "Failed to enable user"
  }
}
```

**Files to modify:**
- `webapp-v2/src/locales/en/translation.json`

### 4. Testing

**Backend tests:**
- Unit test for UserAdminHandlers
  - Test successful disable
  - Test successful enable
  - Test validation errors
  - Test self-disable prevention
  - Test authentication requirements (admin-only)

**Frontend tests:**
- Test button appears with correct text based on status
- Test confirmation dialog appears
- Test API call is made with correct payload
- Test table refreshes after success
- Test error handling
- Test self-disable prevention

**Manual testing checklist:**
- [ ] System admin can disable an active account
- [ ] System admin can enable a disabled account
- [ ] Regular system user cannot access the disable endpoint
- [ ] Cannot disable your own account (shows error)
- [ ] Disabled user cannot sign in
- [ ] Enabled user can sign in again
- [ ] Action is logged with actor and target UIDs
- [ ] Table updates immediately after action

### 5. Documentation

**Update docs:**
- Add entry to user management documentation
- Document the audit logging for account disable/enable actions
- Add to admin features list

## Security Considerations

1. **Authorization:**
   - Only SYSTEM_ADMIN role should be able to disable/enable accounts
   - Must prevent self-disable (system admin disabling their own account)
   - Log all disable/enable actions with actor UID for audit trail

2. **Validation:**
   - Validate UID format
   - Validate `disabled` is boolean
   - Reject updates to other user fields (only `disabled` allowed)

3. **Rate Limiting:**
   - Consider adding rate limits to prevent bulk disable attacks
   - Could add a cooldown period between actions on the same user

4. **Audit Trail:**
   - Log format: `Admin {actorUid} {enabled|disabled} user {targetUid}`
   - Include timestamp and request context
   - Consider adding to activity feed or separate audit log collection

## Future Enhancements

- Bulk disable/enable (select multiple users)
- Disable reason field (why was this account disabled?)
- Auto-notification email to disabled users
- Temporary disable with auto-enable after X days
- Disable reason categories (spam, abuse, payment, other)
- View disable history per user

## Success Metrics

- System admins can disable/enable accounts without Firebase Console
- Average time to disable an account < 5 seconds
- No accidental self-disables (prevented by validation)
- All disable/enable actions logged with actor information
- Zero unauthorized disable attempts succeed

## Dependencies

- None (uses existing auth and admin infrastructure)

## Estimated Effort

- Backend: 2-3 hours (endpoint + tests)
- Frontend: 2-3 hours (UI + API client + tests)
- Testing & docs: 1-2 hours
- **Total: ~5-8 hours**
