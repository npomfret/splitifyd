
# Decouple HeaderComponent from Global Firebase Object

**Problem**: The `HeaderComponent.attachEventListeners` method in `webapp/js/components/header.js` directly calls `firebase.auth().signOut()`. This creates a tight coupling with the global `firebase` object, which is a bad practice in modern JavaScript development. It makes the component less modular, harder to test, and dependent on the global `firebase` object being available.

**File**: `webapp/js/components/header.js`

**Suggested Solution**:
1. **Use `AuthManager` for Logout**: The `AuthManager` class (`webapp/js/auth.js`) already provides a `logout()` method that handles clearing the token and redirecting. The `HeaderComponent` should delegate the logout action to `window.authManager.logout()`.
2. **Remove Direct Firebase Dependency**: Eliminate the direct dependency on the global `firebase` object within `HeaderComponent`.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the `HeaderComponent` will be more modular and less coupled to global objects.

**Risk**: Low. The changes are localized to the `HeaderComponent` and involve delegating to an existing, well-defined logout mechanism. The risk of side effects is minimal.

**Complexity**: Low. This is a straightforward refactoring that involves changing a function call.

**Benefit**: Medium. This change will improve the modularity and testability of the `HeaderComponent`, making it more robust and easier to maintain.
