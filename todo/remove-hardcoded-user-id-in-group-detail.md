# Remove Hardcoded User ID in Group Detail

**Problem**: The `currentUser` in `webapp/js/group-detail.js` is initialized using `localStorage.getItem('userId') || 'user1'`. The hardcoded `'user1'` is a development hack that bypasses proper authentication and can lead to incorrect behavior or security vulnerabilities if not removed before production deployment. It allows access to group details without a valid authenticated user, which is a security flaw.

**File**: `webapp/js/group-detail.js`

**Suggested Solution**:
1. **Always Use Authenticated User**: Ensure that `currentUser` is always derived from the authenticated Firebase user (e.g., `firebase.auth().currentUser.uid`). This means the page should only load if a valid user is authenticated.
2. **Remove Hardcoded Fallback**: Eliminate the `|| 'user1'` fallback. If a user is not authenticated, the application should redirect to the login page or handle the unauthenticated state appropriately (e.g., display an error message and prevent content loading).
3. **Integrate with `AppInit` and `PageBuilder`**: As suggested in another `todo`, integrate this page's initialization with `AppInit.initialize` and `PageBuilder.buildAuthenticatedPage` to ensure that `currentUser` is reliably available and authenticated before any group details are loaded.

**Behavior Change**: This is a behavior change. The application will no longer allow unauthenticated access to group details. This is a crucial security improvement, ensuring that only legitimate users can view their financial data.

**Risk**: Low. The changes are localized to the user ID retrieval and are unlikely to have any side effects on authenticated users. The primary risk is ensuring that the authentication flow correctly redirects unauthenticated users.

**Complexity**: Low. This is a straightforward change that involves removing a hardcoded value and relying on the existing authentication mechanism.

**Benefit**: High. This change will significantly improve the security and correctness of the application by ensuring that only authenticated users can access group details, preventing unauthorized data exposure.