# Decouple Frontend Config from FirebaseConfigManager Initialization

**Problem**: The `Config` class in `webapp/js/config.js` currently takes on the responsibility of ensuring that `window.firebaseConfigManager` is initialized via its `_ensureInitialized` method. This creates a tight coupling and an unnecessary responsibility for the `Config` class. Ideally, the `FirebaseConfigManager` should be initialized once at the application's entry point (e.g., `app-init.js`), and other modules, like `Config`, should simply assume it's ready or be passed an already initialized instance.

**File**: `webapp/js/config.js`

**Suggested Solution**:
1. **Remove Initialization Logic**: Eliminate the `_ensureInitialized` method and the `_configPromise` from the `Config` class. The `Config` class should not be concerned with the initialization state of `FirebaseConfigManager`.
2. **Assume Initialized State**: The `Config` class should assume that `window.firebaseConfigManager` is already initialized when its methods are called. This implies that the application's main entry point (e.g., `AppInit.initialize`) is solely responsible for ensuring `FirebaseConfigManager` is ready before any other modules attempt to use it.
3. **Pass Initialized Instance (Optional but Recommended)**: For improved testability and explicit dependency management, consider modifying the `Config` class constructor to accept the initialized `FirebaseConfigManager` instance as a parameter. This makes the dependency clear and allows for easier mocking in tests.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the `Config` class will be more focused on its core responsibility of providing configuration values and will have reduced coupling.

**Risk**: Low. The changes are localized to the `Config` class and are unlikely to have any side effects, provided the `FirebaseConfigManager` is indeed initialized elsewhere in the application's startup flow.

**Complexity**: Low. This is a straightforward refactoring that involves removing initialization logic and potentially adjusting a constructor.

**Benefit**: Medium. This change will improve modularity, reduce coupling between the `Config` class and `FirebaseConfigManager`, and make the overall application initialization flow clearer.