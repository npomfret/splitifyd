# Decouple AuthManager from Global FirebaseAuth Object

**Problem**: The `AuthManager` class in `webapp/js/auth.js` directly accesses Firebase Authentication functions (e.g., `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`) via the global `window.firebaseAuth` object. This creates a tight coupling with a global variable, which is considered a bad practice in modern JavaScript development. It makes the `AuthManager` less testable (as mocking global objects is difficult), less modular, and dependent on the order of script loading.

**File**: `webapp/js/auth.js`

**Suggested Solution**:
1. **Import Firebase Auth Functions Directly**: Instead of relying on `window.firebaseAuth`, import the necessary Firebase Auth functions directly from the Firebase Auth module (e.g., `import { getAuth, signInWithEmailAndPassword, ... } from 'firebase/auth';`). This assumes that Firebase SDK imports are managed via a package manager and bundler (as suggested in another `todo`).
2. **Pass Auth Instance as Dependency**: If the `AuthManager` needs access to the Firebase Auth instance (returned by `getAuth()`), it should be passed as a dependency during `AuthManager` instantiation. This allows for explicit dependency injection and easier testing.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the `AuthManager` will be more modular, testable, and adhere to modern JavaScript best practices.

**Risk**: Low. The changes are localized to the `AuthManager` class and involve updating import mechanisms. As long as the correct Firebase Auth functions are imported and used, the risk of side effects is minimal.

**Complexity**: Medium. This change involves modifying the `AuthManager` class to use direct imports and potentially accept the Auth instance as a dependency, which might require minor adjustments to its constructor and initialization.

**Benefit**: High. This change will significantly improve the modularity, testability, and maintainability of the `AuthManager` class, making it easier to understand, debug, and evolve.