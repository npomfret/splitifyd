# Remove Unused Private Method in AuthManager

**Problem**: The `AuthManager` class in `webapp/js/auth.js` contains a private method `#makeRequest` that is defined but never called or used within the class. This constitutes dead code, which adds unnecessary complexity, increases the codebase size, and can be confusing for developers trying to understand the codebase. It also implies a potential feature that was started but not completed or removed.

**File**: `webapp/js/auth.js`

**Suggested Solution**:
1. **Remove the Dead Code**: Delete the `#makeRequest` method from the `AuthManager` class. If this method was intended for future use, it should be re-evaluated and re-implemented when that feature is actively being developed.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, as the method was unused and its removal will not impact any existing logic.

**Risk**: Low. Removing unused code is generally safe and reduces the attack surface. The primary risk is if the method was implicitly relied upon, which is unlikely for a private, unused method.

**Complexity**: Low. This is a straightforward change that involves deleting a few lines of code.

**Benefit**: Low. This change will improve code clarity, reduce the codebase size, and remove potential confusion for future developers.