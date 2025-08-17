# Task: Implement Shared Package for Monorepo

**Ticket:** [TICKET-NUMBER]
**Status:** To Do

## 1. Problem Statement

Currently, the project shares code between the `firebase` functions and the `webapp-v2` client by using deep, relative paths (e.g., `../../firebase/functions/src/types/webapp-shared-types.ts`). This approach has proven to be a significant source of friction and errors:

- **Brittle Imports:** The paths are fragile and prone to breaking if files are moved.
- **Poor Tooling Support:** Test runners like `vitest` and even IDEs struggle to resolve these paths correctly, leading to `Failed to resolve import` errors and requiring complex, unreliable path alias configurations in `tsconfig.json`.
- **Lack of Clarity:** It creates a "leaky" abstraction where the frontend is tightly coupled to the backend's internal directory structure.
- **Unscalable:** As the amount of shared code grows, this method will become increasingly unmanageable.

The recent effort to refactor magic strings highlighted this problem, forcing the use of relative paths as a workaround for failing tests, which is not a sustainable solution.

## 2. Proposed Solution

The standard, industry-best-practice solution is to treat our project as a proper monorepo and create a dedicated, internal `shared` package. This involves:

1.  **Creating a new package:** A new directory, `packages/shared`, will house all code meant to be used by both the client and server.
2.  **Configuring Workspaces:** The root `package.json` will be configured to recognize the monorepo structure (using npm or pnpm workspaces).
3.  **Handling the Firebase Build Process:** The primary challenge is that the Firebase deployment process only bundles the `functions` directory, ignoring any external local packages. We will solve this by creating a `predeploy` script that:
    a. Builds the `shared` package.
    b. Packs the built code into a tarball (`.tgz`).
    c. Copies the tarball into the `functions` directory.
    d. Temporarily updates `functions/package.json` to use the local tarball as its dependency.
4.  **Adding a `predeploy` hook:** The `firebase.json` configuration will be updated to run this script automatically before any deployment or emulator startup, ensuring the shared code is always available.

## 3. Benefits

This approach provides substantial long-term benefits that justify the initial setup cost:

- **Clean, Robust Imports:** Code will be imported using a clear, package-based syntax (e.g., `import { ... } from '@splitifyd/shared'`).
- **Excellent Tooling Support:** It resolves all path resolution issues with IDEs, TypeScript, and test runners, eliminating the root cause of our current test failures.
- **Explicit Dependency Management:** It establishes a clear, well-defined API for the shared code, improving modularity and reducing coupling.
- **Improved Maintainability & Scalability:** The structure is clean, easy to understand, and scales effortlessly as the project grows.

## 4. Implementation Plan

1.  **Create `packages/shared` Directory Structure:**
    - `packages/shared/`
    - `packages/shared/src/`

2.  **Create `package.json` for the Shared Package:**
    - Create `packages/shared/package.json` with the name `@splitifyd/shared`, a `main` entry point, and a `types` entry point.

3.  **Create `tsconfig.json` for the Shared Package:**
    - Create `packages/shared/tsconfig.json` to configure the TypeScript build for this package.

4.  **Move Shared Code:**
    - Move `firebase/functions/src/types/webapp-shared-types.ts` to `packages/shared/src/index.ts`.
    - Export all constants from this new `index.ts` file.

5.  **Configure Monorepo Workspaces:**
    - Update the root `package.json` to define the `workspaces`, including `packages/*`, `firebase`, and `webapp-v2`.

6.  **Update Package Dependencies:**
    - In `firebase/package.json` and `webapp-v2/package.json`, add `"@splitifyd/shared": "workspace:*"`.
    - Run `npm install` from the root to link the workspaces.

7.  **Create the `predeploy` Script:**
    - Create a new script in `firebase/scripts/pack-shared.ts` (or similar).
    - This script will perform the build, pack, copy, and `package.json` modification steps.

8.  **Update `firebase.json`:**
    - Add a `predeploy` hook to the `functions` section to execute the new packing script.

9.  **Refactor All Imports:**
    - Search the entire codebase (`firebase/` and `webapp-v2/`) and replace all relative-path imports of the shared types with the new package import: `@splitifyd/shared`.

10. **Cleanup Configuration:**
    - Remove the now-unnecessary `paths` aliases (`@shared`, `@test-support`) from all `tsconfig.json` files (`webapp-v2/tsconfig.json`, etc.).

11. **Verification:**
    - Run `npm test` to confirm that all client-side and server-side tests now pass without any import resolution errors.
    - Run the app locally using the emulator to ensure everything works end-to-end.
