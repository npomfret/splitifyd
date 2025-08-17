# Task: Refactor to a Centralized and Encapsulated Firebase Service Layer

## Overview

This task is to refactor the web application's architecture to ensure all Firebase-related logic is handled in a single, central place. The goal is to encapsulate Firebase operations so that implementation details do not leak into the UI components, and to ensure the Firebase SDK is initialized only once. This will improve maintainability, testability, and architectural clarity.

## Analysis of Current Architecture

A review of the codebase confirms that a centralized `FirebaseService` (`webapp-v2/src/app/firebase.ts`) and a corresponding `authStore` already exist. This structure provides a solid foundation for encapsulating authentication logic.

The primary architectural issue is not with the runtime logic, but with **compile-time dependency management**. Currently, numerous frontend components and stores directly import type definitions from deep within the `firebase/functions` directory (e.g., `../../../../firebase/functions/src/shared/shared-types`).

This creates several problems:

- **Brittle Paths:** Imports break easily when files are moved.
- **Poor Encapsulation:** The frontend is tightly coupled to the backend's internal file structure.
- **Tooling Issues:** Build tools, test runners, and IDEs struggle to resolve these complex relative paths.

## Proposed Solution: Implement a Shared Monorepo Package

The most effective way to achieve true encapsulation and solve the current issues is to implement the plan outlined in **`tasks/implement-shared-package-monorepo.md`**.

This involves creating a dedicated `@splitifyd/shared` package within a `packages/` directory to house all code shared between the `firebase` and `webapp-v2` projects.

### Key Implementation Steps

1.  **Create the `@splitifyd/shared` Package:**
    - Establish the `packages/shared` directory.
    - Create a `package.json` for the new shared package.
    - Move all shared code, primarily the type definitions from `firebase/functions/src/shared/shared-types.ts`, into `packages/shared/src/index.ts`.

2.  **Configure Monorepo Workspaces:**
    - Update the root `package.json` to define npm/pnpm workspaces, formally linking `webapp-v2`, `firebase`, and `packages/shared`.

3.  **Refactor Imports:**
    - Replace all deep relative imports in `webapp-v2` and `firebase` with the new package import:
        - **Before:** `import type { Group } from '../../../../firebase/functions/src/shared/shared-types';`
        - **After:** `import type { Group } from '@splitifyd/shared';`

4.  **Update Build Processes:**
    - As detailed in the monorepo task, create a `predeploy` script for Firebase to ensure the `shared` package is correctly built and included during deployment.

## How This Achieves the Goal

- **Centralization:** The `@splitifyd/shared` package becomes the single, canonical source for all shared code and types. The existing `FirebaseService` remains the central point for runtime logic.
- **Single Initialization:** The current singleton pattern for `FirebaseService` already ensures it is initialized only once. This will be maintained.
- **Encapsulation:** By consuming the shared code as a formal package (`@splitifyd/shared`), the frontend is no longer coupled to the backend's file structure. The shared package acts as a well-defined API between the two parts of the monorepo, achieving true encapsulation.

## Benefits

- **Resolves Tooling Issues:** Eliminates the root cause of path resolution errors in Vitest and IDEs.
- **Improves Maintainability:** Makes the codebase cleaner, more modular, and easier to reason about.
- **Scalable:** Provides a robust foundation for sharing more code (e.g., validation logic, constants) in the future.
