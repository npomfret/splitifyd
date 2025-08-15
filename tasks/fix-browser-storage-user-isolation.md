# Fix Browser Storage User Isolation

**Priority**: High  
**Type**: Security & Data Integrity  
**Affects**: Authentication, User Preferences, Multi-user Environments  
**Status**: Analysis Complete - Implementation Needed

## Problem Summary

The current browser storage implementation lacks proper user isolation, causing personal data to leak between users on shared devices and creating authentication state conflicts. This was discovered while fixing flaky E2E tests but represents a broader security and UX issue.

## Detailed Analysis

### Current Storage Usage (Problematic)

**Global Storage Keys (NOT user-isolated):**

1. **Authentication Token**
   - Key: `'auth_token'` (defined in `src/constants.ts`)
   - Used in: `src/app/apiClient.ts`
   - Problem: Last logged-in user's token overwrites previous users
   - Impact: Authentication conflicts, session hijacking on shared devices

2. **Recent Currencies**  
   - Key: `'recentCurrencies'`
   - Used in: `src/app/services/currencyService.ts`
   - Problem: User A's currency preferences appear in User B's dropdown
   - Impact: Privacy violation, UX confusion

3. **Recent Expense Categories**
   - Key: `'recent-expense-categories'` 
   - Used in: `src/app/stores/expense-form-store.ts`
   - Problem: User A's expense categories suggest to User B
   - Impact: Privacy violation, potential financial data leakage

### Properly Isolated Storage (Already Fixed)

**User-Scoped Keys (Good Examples):**

1. **Currency Defaults**
   - Key Pattern: `lastUsedCurrency_${userId}_${groupId}`
   - Used in: `src/utils/currency/currencyDefaults.ts`
   - Status: ✅ Properly isolated by user and group

## Security Implications

### Data Leakage Scenarios

1. **Shared Computers**: Office, family, or public computers where multiple users access Splitifyd
2. **Browser Profile Sharing**: When users share browser profiles or forget to use incognito mode
3. **Testing Environments**: E2E tests, development environments with multiple test users
4. **Support/Demo Scenarios**: Customer support or demo environments

### Privacy Violations

- **Financial Categories**: Expense categories reveal spending habits and lifestyle
- **Currency Preferences**: May reveal travel patterns or financial relationships
- **Authentication State**: Can lead to accessing wrong user's account

### Technical Issues

- **Test Flakiness**: Exactly what we encountered - authentication state persisting between test users
- **Development Friction**: Developers need to clear storage when switching test accounts
- **Multi-tenant Bugs**: Hard-to-reproduce issues in multi-user environments

## Current Implementation Details

### Files Requiring Changes

1. **`src/app/apiClient.ts`**
   ```typescript
   // Current: Global auth token
   const token = localStorage.getItem(AUTH_TOKEN_KEY); // 'auth_token'
   localStorage.setItem(AUTH_TOKEN_KEY, token);
   
   // Needed: User-scoped auth token with fallback handling
   ```

2. **`src/app/services/currencyService.ts`**
   ```typescript
   // Current: Global recent currencies
   localStorage.getItem('recentCurrencies');
   localStorage.setItem('recentCurrencies', JSON.stringify(recent));
   
   // Needed: User-scoped recent currencies
   ```

3. **`src/app/stores/expense-form-store.ts`**
   ```typescript
   // Current: Global recent categories
   const RECENT_CATEGORIES_KEY = 'recent-expense-categories';
   localStorage.getItem(RECENT_CATEGORIES_KEY);
   
   // Needed: User-scoped recent categories
   ```

### Authentication Flow Complexity

The auth token presents a chicken-and-egg problem:
- We need the user ID to scope storage
- But we need to read the auth token to get the user ID
- This requires careful handling during login/logout flows

## Implementation Plan

### Phase 1: Create Storage Utility Layer

**Create `src/utils/userScopedStorage.ts`:**

```typescript
interface UserScopedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void; // Clear all user-scoped keys
}

class UserScopedStorageImpl implements UserScopedStorage {
  constructor(private getUserId: () => string | null) {}
  
  private getScopedKey(key: string): string {
    const userId = this.getUserId();
    return userId ? `user_${userId}_${key}` : `global_${key}`;
  }
  
  // Implementation methods...
}
```

**Features:**
- Automatic user ID prefixing
- Fallback to global keys when user ID unavailable
- Migration support for existing data
- Clear all user data on logout

### Phase 2: Update Authentication Storage

**Modify `src/app/apiClient.ts`:**

1. **During Login**: Migrate any existing global auth token to user-scoped storage
2. **During Logout**: Clear user-scoped auth token and preferences
3. **Auth Header**: Read from user-scoped storage with global fallback
4. **Token Refresh**: Update user-scoped storage

**Migration Logic:**
```typescript
// On successful login, migrate global token if it exists
const globalToken = localStorage.getItem('auth_token');
if (globalToken && !userScopedStorage.getItem('auth_token')) {
  userScopedStorage.setItem('auth_token', globalToken);
  localStorage.removeItem('auth_token'); // Clean up global
}
```

### Phase 3: Update User Preference Storage

**Fix Currency Service:**
- Replace global `'recentCurrencies'` with user-scoped storage
- Migrate existing data for current user
- Clear data on logout

**Fix Expense Categories:**
- Replace global `'recent-expense-categories'` with user-scoped storage
- Migrate existing data for current user
- Clear data on logout

### Phase 4: Enhanced Test Infrastructure

**Update E2E Test Fixtures:**
- Ensure `createUnauthenticatedUser()` clears user-scoped storage
- Add explicit storage isolation verification
- Create multi-user storage test scenarios

**Add Storage Isolation Tests:**
```typescript
test('storage isolation between users', async ({ browser }) => {
  // Create two users, verify their preferences don't leak
});
```

### Phase 5: Cleanup and Migration

**Data Migration Strategy:**
1. **Graceful Migration**: Move global data to user-scoped on first access
2. **Cleanup**: Remove global keys after successful migration  
3. **Backward Compatibility**: Support reading old keys during transition period
4. **Version Tracking**: Track migration status to avoid repeated migrations

## Implementation Checklist

### Core Changes
- [ ] Create `UserScopedStorage` utility class
- [ ] Integrate with authentication flow in `apiClient.ts`  
- [ ] Update `CurrencyService` to use user-scoped storage
- [ ] Update expense form store to use user-scoped storage
- [ ] Add proper logout cleanup

### Migration & Compatibility  
- [ ] Implement graceful data migration
- [ ] Add version tracking for migrations
- [ ] Ensure backward compatibility during transition
- [ ] Clean up old global keys

### Testing & Verification
- [ ] Update E2E test fixtures for proper isolation
- [ ] Add multi-user storage isolation tests
- [ ] Verify shared device scenarios
- [ ] Test migration edge cases

### Documentation
- [ ] Document new storage patterns
- [ ] Update contribution guidelines
- [ ] Add troubleshooting guide for storage issues

## Success Criteria

1. **Data Isolation**: User A's preferences never appear for User B
2. **Authentication Security**: No auth token conflicts on shared devices
3. **Test Stability**: E2E tests pass consistently without manual storage clearing
4. **Migration Success**: Existing users don't lose their preferences
5. **Performance**: No noticeable impact on app performance

## Risks & Mitigation

**Risk**: Breaking existing user preferences during migration  
**Mitigation**: Implement graceful migration with fallbacks and extensive testing

**Risk**: Authentication flow complexity  
**Mitigation**: Careful handling of edge cases and comprehensive auth flow testing  

**Risk**: Storage quota issues with user prefixing  
**Mitigation**: Monitor storage usage and implement cleanup strategies

## Related Issues

- **E2E Test Flakiness**: This directly caused the authentication state issues we just fixed
- **Customer Support**: Reported confusion when users share computers
- **Development Workflow**: Developers frequently need to clear storage when testing

## References

- **Test Fix**: The recent fix to `mixed-auth-test.ts` was a workaround for this underlying issue
- **Storage Pattern**: `currencyDefaults.ts` already implements proper user-scoped storage pattern
- **Security Best Practices**: Browser storage should always be scoped to prevent data leakage