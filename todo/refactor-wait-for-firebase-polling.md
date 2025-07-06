# Refactor waitForFirebase Polling Mechanism

**Problem**: The `waitForFirebase` method in `webapp/js/app-init.js` uses a polling mechanism (`setTimeout` in a `while` loop) to wait for the `window.firebase` object to become available. This is an anti-pattern for asynchronous operations. It can lead to:
- **Race conditions**: The `window.firebase` object might not be available within the polling interval, or it might become available after the polling has stopped.
- **Unnecessary delays**: If `window.firebase` is available quickly, the `setTimeout` still introduces a delay.
- **Inefficiency**: Constant polling consumes CPU cycles unnecessarily.
- **Lack of robustness**: It makes the initialization process less predictable and harder to debug.

**File**: `webapp/js/app-init.js`

**Suggested Solution**:
1. **Leverage Promise-Based Initialization**: Since `firebase-config.js` already initializes Firebase and exposes `window.firebaseConfigManager.initialize()` as a Promise, `AppInit.initialize` should directly `await` this Promise. This ensures that `AppInit` proceeds only after Firebase is fully set up.
2. **Remove Polling**: Eliminate the `waitForFirebase` method and its polling logic entirely. The `AppInit` class should rely on the explicit Promise resolution from `firebaseConfigManager.initialize()`.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the Firebase initialization process will be more efficient, reliable, and aligned with modern asynchronous JavaScript patterns.

**Risk**: Low. The changes are localized to the Firebase initialization logic and involve replacing an unreliable pattern with a robust one. As long as `firebaseConfigManager.initialize()` reliably resolves, the risk of introducing bugs is minimal.

**Complexity**: Low. This is a straightforward refactoring that involves leveraging existing Promise-based initialization and removing dead code.

**Benefit**: Medium. This change will improve the efficiency and reliability of the Firebase initialization process, reducing potential race conditions and unnecessary delays, and making the application startup more predictable.