# Remove Global Firebase Exposure

**Problem**: The `FirebaseConfigManager` in `webapp/js/firebase-config.js` explicitly exposes `window.firebase` and `window.firebaseAuth` globally. While the code comments suggest this is for "legacy code or direct access," it is generally considered a bad practice in modern JavaScript development. Global variables can lead to:
- **Naming conflicts**: Collisions with other scripts or libraries.
- **Reduced maintainability**: Code becomes harder to reason about, as dependencies are implicit.
- **Limited testability**: Mocking global objects is more challenging.
- **Lack of modularity**: Components become tightly coupled to the global scope.

**File**: `webapp/js/firebase-config.js`

**Suggested Solution**:
1. **Remove Global Exposure**: Delete the `Object.defineProperty` calls that expose `window.firebase` and `window.firebaseAuth`. These global assignments are no longer necessary with a modular approach.
2. **Use Explicit Imports**: Update all files that currently rely on these global variables to explicitly import the necessary Firebase modules and functions. For example, instead of `firebase.auth().currentUser`, use `import { getAuth } from 'firebase/auth'; const auth = getAuth(); auth.currentUser;`.
3. **Dependency Injection**: For classes or modules that need Firebase instances, consider passing them as dependencies during instantiation (dependency injection) rather than relying on global access.

**Behavior Change**: This is a behavior change. Files that currently rely on global Firebase objects will need to be updated to use explicit imports. This will break existing code that directly accesses `window.firebase` or `window.firebaseAuth`.

**Risk**: Medium. This change requires identifying and updating *all* files that rely on global Firebase objects. A comprehensive search and careful refactoring are needed to ensure no references are missed, which can be a significant undertaking.

**Complexity**: Medium. This change involves modifying multiple files across the frontend to replace global access with explicit imports, potentially requiring changes to module structures.

**Benefit**: High. This change will significantly improve code modularity, reduce naming conflicts, enhance testability, and make the codebase more maintainable and aligned with modern JavaScript best practices.