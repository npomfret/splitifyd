# Refactor Expense Detail Initialization to Avoid setTimeout

**Problem**: The `DOMContentLoaded` listener in `webapp/js/expense-detail.js` uses a `setTimeout` with a hardcoded delay to wait for `window.authManager` to be initialized and authenticated. This is an unreliable and fragile pattern that can lead to race conditions (if `authManager` is not ready in time), unnecessary delays (if `authManager` is ready sooner), and makes the initialization process less robust and harder to debug.

**File**: `webapp/js/expense-detail.js`

**Suggested Solution**:
1. **Leverage `AppInit.initialize`**: The `AppInit.initialize` method (from `webapp/js/app-init.js`) is specifically designed to handle application-wide initialization, including Firebase setup and authentication checks. The `expense-detail.js` script should integrate with `AppInit.initialize` by passing its page-specific logic as a callback.
2. **Use `PageBuilder.buildAuthenticatedPage`**: As described in `UI-COMPONENT-GUIDE.md`, the recommended way to build authenticated pages is by using `PageBuilder.buildAuthenticatedPage`. This utility handles authentication checks, user loading, and ensures that the page content is rendered only after the user is authenticated. This would replace the manual `setTimeout` and `authManager` checks.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the initialization process will be more robust, reliable, and aligned with the established frontend architecture.

**Risk**: Low. The changes are localized to the initialization logic and involve adopting existing, more robust patterns. The risk of introducing bugs is minimal if the integration is done correctly.

**Complexity**: Medium. This change involves integrating with the existing `AppInit` and `PageBuilder` patterns, which might require restructuring the `expense-detail.js` script to fit the `PageBuilder`'s `renderContent` and `onReady` callbacks.

**Benefit**: High. This change will significantly improve the reliability and robustness of the expense detail page initialization, eliminate race conditions, reduce unnecessary delays, and make the frontend code more consistent with the project's architectural guidelines.