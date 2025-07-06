# Refactor Complex Environment Logic in Config

**Problem**: The environment detection logic in `firebase/functions/src/config.ts` is overly complex and difficult to understand. It uses multiple boolean flags (`ENV_IS_PRODUCTION`, `ENV_IS_DEVELOPMENT`, `ENV_IS_TEST`) and nested ternary operators to determine the current environment and set configuration values. This makes the code hard to read, prone to errors, and difficult to maintain or extend with new environments.

**File**: `firebase/functions/src/config.ts`

**Suggested Solution**:
1. **Simplify Environment Detection**: Refactor the environment detection logic to be more straightforward. Instead of multiple boolean flags, use a single `environment` variable that can explicitly hold one of three values: `'production'`, `'development'`, or `'test'`. This can be determined once at the top of the file.
2. **Use a Switch Statement or Object Map**: Replace the complex ternary operators with a `switch` statement or an object map to set environment-specific configurations. This will make the code more readable, easier to modify, and clearly delineate configurations for each environment.
3. **Remove Redundant Variables**: Remove the `isBuildPhase` variable and other redundant boolean flags or temporary variables that complicate the logic without adding significant value.
4. **Centralize Environment Variables**: Ensure all environment-dependent values are clearly sourced from `process.env` and handled consistently.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the configuration logic will be significantly easier to understand and maintain.

**Risk**: Low. The changes are confined to the configuration file and involve simplifying existing logic. As long as the new logic correctly maps to the old behavior, the risk of introducing bugs is minimal.

**Complexity**: Low. This is a straightforward refactoring that primarily involves reorganizing and simplifying conditional logic.

**Benefit**: High. This change will make the configuration logic much more readable, maintainable, and less prone to errors. It will also simplify the process of adding or modifying environment-specific settings in the future.