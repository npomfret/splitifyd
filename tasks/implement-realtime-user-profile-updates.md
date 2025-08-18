# Implement Real-Time User Profile Updates

**Priority:** P2 - Medium  
**Complexity:** Medium  
**Estimated Effort:** 2-3 days  
**Status:** Not Started  

## Problem Statement

Currently, the user profile management implementation requires manual page refreshes to see updated data in the UI after successful API calls. This creates a suboptimal user experience and violates the application's real-time update principles established elsewhere in the codebase.

### Current Issues:

1. **Manual Page Refresh Required**: After updating display name, the SettingsPage POM calls `page.reload()` to see changes
2. **Inconsistent UX**: Other parts of the application use real-time updates, creating inconsistent behavior
3. **Test Complexity**: E2E tests need explicit refresh logic that shouldn't be necessary
4. **Performance Impact**: Full page reloads are slower than targeted updates

### Code Locations Affected:

- `e2e-tests/src/pages/settings.page.ts:100-102` - Manual page refresh in POM
- `webapp-v2/src/pages/SettingsPage.tsx:64` - Auth token refresh without UI update
- User menu display name updates across navigation components

## Solution Overview

Implement real-time user profile updates using the existing Firebase Auth user object and Preact signals to automatically reflect profile changes without requiring page refreshes.

### Technical Approach:

1. **Enhanced Auth Store Integration**
   - Extend auth store to listen for user profile changes
   - Update user signals when profile data changes
   - Ensure user menu and navigation reflect changes immediately

2. **Optimistic UI Updates**
   - Update UI immediately on successful API responses
   - Roll back changes if API calls fail
   - Maintain loading states during updates

3. **Cross-Component Synchronization**
   - Ensure all components displaying user data update automatically
   - Use centralized user state management via auth store
   - Remove manual token refresh requirements

## Implementation Plan

### Phase 1: Auth Store Enhancement

**Files to Modify:**
- `webapp-v2/src/app/stores/auth-store.ts`
- `webapp-v2/src/app/hooks/useAuthRequired.ts`

**Changes:**
```typescript
// Add user profile update method to auth store
async updateUserProfile(updates: { displayName?: string }) {
  // Update local user object immediately (optimistic update)
  // Call API
  // On success: keep changes, emit update event
  // On failure: revert changes, show error
}

// Add user signal watching for reactive updates
const userSignal = computed(() => authStore.user);
```

### Phase 2: SettingsPage Real-Time Updates

**Files to Modify:**
- `webapp-v2/src/pages/SettingsPage.tsx`

**Changes:**
```typescript
// Remove manual token refresh
// Use auth store's updateUserProfile method
// Listen to user signal changes for automatic UI updates
// Remove page reload requirements

const handleDisplayNameUpdate = async () => {
  try {
    await authStore.updateUserProfile({ displayName: displayName.trim() });
    // UI updates automatically via signals - no manual refresh needed
    setSuccessMessage('Profile updated successfully');
  } catch (error) {
    // Handle errors, UI reverts automatically
    setErrorMessage('Failed to update profile. Please try again.');
  }
};
```

### Phase 3: Navigation Component Updates

**Files to Modify:**
- `webapp-v2/src/components/layout/Header.tsx` (or equivalent navigation)
- `webapp-v2/src/components/ui/UserMenu.tsx` (if exists)

**Changes:**
- Subscribe to user signal changes
- Automatically update displayed name when user profile changes
- Remove any manual refresh logic

### Phase 4: E2E Test Simplification

**Files to Modify:**
- `e2e-tests/src/pages/settings.page.ts`
- `e2e-tests/src/tests/normal-flow/user-profile-management.e2e.test.ts`

**Changes:**
```typescript
// Remove manual page refresh from updateDisplayName method
async updateDisplayName(newDisplayName: string): Promise<void> {
  // ... existing logic ...
  await this.verifySuccessMessage('Profile updated successfully');
  await this.waitForLoadingComplete('save');
  
  // REMOVE: Manual page refresh - no longer needed
  // await this.page.reload();
  // await this.waitForNetworkIdle();
}

// Add real-time update verification
async verifyRealTimeDisplayNameUpdate(expectedName: string): Promise<void> {
  // Wait for display name to update automatically
  await expect(this.getProfileDisplayName()).toContainText(expectedName);
  
  // Verify user menu also updates automatically
  await expect(this.page.getByTestId('user-menu-button')).toContainText(expectedName);
}
```

## Benefits

### User Experience:
- **Immediate Feedback**: Profile changes reflect instantly in UI
- **Consistent Behavior**: Matches real-time updates used elsewhere in app
- **Smoother Interaction**: No jarring page reloads interrupting user flow

### Developer Experience:
- **Simpler Tests**: E2E tests don't need manual refresh logic
- **Better Architecture**: Centralized user state management
- **Easier Maintenance**: Single source of truth for user data

### Performance:
- **Faster Updates**: Targeted DOM updates vs full page reloads
- **Reduced Network Traffic**: No unnecessary full page requests
- **Better Mobile Experience**: Avoids reload on slower connections

## Acceptance Criteria

### Functional Requirements:
- [ ] Display name updates reflect immediately in settings page
- [ ] User menu shows updated display name without refresh
- [ ] Profile changes persist across page navigation
- [ ] Error states properly revert optimistic updates
- [ ] Loading states work correctly during updates

### Technical Requirements:
- [ ] No manual `page.reload()` calls in production code
- [ ] No manual `page.reload()` calls in E2E tests
- [ ] Auth store manages all user profile state
- [ ] All user-displaying components use reactive signals
- [ ] Error handling maintains data consistency

### Test Requirements:
- [ ] E2E tests pass without manual refresh
- [ ] Real-time update verification in tests
- [ ] Error scenario testing (network failures, validation errors)
- [ ] Cross-component update verification
- [ ] Performance regression testing

## Implementation Notes

### Dependencies:
- Existing Preact signals infrastructure
- Auth store architecture
- Firebase Auth integration

### Considerations:
- **Error Handling**: Ensure optimistic updates can be cleanly reverted
- **Race Conditions**: Handle multiple simultaneous profile updates
- **Offline Behavior**: Consider what happens when API calls fail
- **Testing**: Ensure E2E tests are more reliable without refresh logic

### Potential Challenges:
1. **Signal Reactivity**: Ensuring all components properly subscribe to user changes
2. **State Consistency**: Maintaining consistency between auth tokens and UI state
3. **Error Recovery**: Properly handling partial failures and rollbacks
4. **Test Timing**: E2E tests may need to wait for real-time updates vs instant refreshes

## Related Tasks

- **Streaming Implementation**: This aligns with the broader real-time update strategy
- **Auth Store Refactoring**: May require auth store enhancements
- **Component Architecture**: Could benefit from signal-based component patterns

## Success Metrics

- **User Experience**: Zero page refreshes required for profile updates
- **Test Reliability**: E2E tests pass consistently without refresh logic
- **Performance**: Profile update response time < 500ms for visual feedback
- **Code Quality**: Reduced complexity in E2E test page objects

## Future Considerations

This implementation sets the foundation for:
- Real-time user preference updates
- Live avatar/photo updates
- Real-time notification settings
- Broader real-time user data synchronization

---

**Created:** 2025-08-18  
**Last Updated:** 2025-08-18  
**Assigned To:** TBD  
**Dependencies:** None  
**Blocked By:** None