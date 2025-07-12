# Monorepo Build System Improvement Plan

## 1. The Problem

The current build system is fragile and fails on a clean checkout. The command `npm run dev:with-data` fails with the error `Cannot find module '@splitifyd/shared-types'`.

This happens because the `shared-types` package, which is a dependency for both `firebase/functions` and `webapp`, is not built before the packages that depend on it. The current build scripts are manually chained and do not correctly handle the dependency graph of the monorepo.

The use of `file:` dependencies in `package.json` files creates symlinks, but it does not guarantee the build order. This is a significant design flaw in a monorepo setup.

## 2. The Solution: Adopt a Modern Monorepo Strategy

To fix this, we will adopt a modern monorepo strategy using `npm` workspaces for package management and Turborepo for build orchestration. This will provide a robust, maintainable, and high-performance build process.

### 2.1. Foundation: `npm` Workspaces

`npm` workspaces are the modern standard for managing monorepos with `npm`. They handle dependency hoisting and local package symlinking, which is the foundation of our new setup.

### 2.2. High-Performance Builds: Turborepo

[Turborepo](https://turbo.build/repo) is a high-performance build system for JavaScript and TypeScript codebases. It sits on top of `npm` workspaces and provides:

*   **Incremental Builds:** Never rebuild the same code twice.
*   **Parallel Execution:** Run builds, tests, and other tasks in parallel.
*   **Remote Caching:** Share build caches across your team and CI/CD pipelines.
*   **Task Pipelines:** Define the relationships between your tasks and let Turborepo optimize their execution.

## 3. Detailed Implementation Plan

### Step 1: Create a Root `package.json` and Define Workspaces

We will create a `package.json` in the project root to define the workspaces and add Turborepo as a development dependency.

```json
// /package.json
{
  "name": "splitifyd-monorepo",
  "private": true,
  "workspaces": [
    "shared-types",
    "firebase/functions",
    "webapp"
  ],
  "scripts": {
    "build": "turbo run build",
    "clean": "turbo run clean && rm -rf node_modules",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^1.13.3",
    "typescript": "^5.6.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.19.2"
  }
}
```

### Step 2: Create a `turbo.json` Configuration

Turborepo is configured using a `turbo.json` file in the project root. This file defines the task pipeline.

```json
// /turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "lib/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
    },
    "dev": {
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

### Step 3: Update `package.json` Dependencies

We will replace the `file:` protocol with the `workspace:*` protocol for all internal package dependencies. This makes the relationship between packages explicit to `npm` and Turborepo.

**Example: `firebase/functions/package.json`**

**Before:**
```json
"dependencies": {
    "@splitifyd/shared-types": "file:../../shared-types",
    ...
}
```

**After:**
```json
"dependencies": {
    "@splitifyd/shared-types": "workspace:*",
    ...
}
```
This change will also be applied to `webapp/package.json`.

### Step 4: Refactor `package.json` Scripts

We will update the `scripts` in each `package.json` to be compatible with Turborepo.

**`shared-types/package.json`**
```json
"scripts": {
  "build": "tsc",
  "clean": "rm -rf dist"
}
```

**`firebase/functions/package.json`**
```json
"scripts": {
  "build": "tsc",
  "clean": "rm -rf lib",
  "dev": "npm run build && firebase emulators:start"
}
```

**`webapp/package.json`**
```json
"scripts": {
  "build": "webpack", // or your build command
  "clean": "rm -rf dist",
  "dev": "npm run build && http-server dist" // or your dev command
}
```

## 4. New Development Workflow

1.  **Initial Setup:** Run `npm install` from the project root. This will install all dependencies for all workspaces and create the necessary symlinks.
2.  **Development:** Run `npm run dev` from the project root. Turborepo will run the `dev` script for each workspace in parallel.
3.  **Building:** Run `npm run build` from the project root. Turborepo will build all packages in the correct order.
4.  **Testing:** Run `npm test` from the project root to run all tests.

This new setup will resolve the build issues, improve developer experience, and provide a solid foundation for future development.

## 5. Future Considerations

*   **CI/CD Integration:** Turborepo is designed for CI/CD. We can use `turbo run build --cache-dir=.turbo` to cache build artifacts and speed up our pipelines. We can also use Vercel's Remote Caching to share the cache across the team.
*   **Versioning and Publishing:** For managing versions and publishing packages, we can use a tool like [Changesets](https://github.com/changesets/changesets). It works well with monorepos and can automate the release process.

## 6. Useful Resources

*   [Turborepo Documentation](https://turbo.build/repo/docs)
*   [npm Workspaces Documentation](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
*   [Changesets Documentation](https://github.com/changesets/changesets/blob/main/docs/introducing-changesets.md)
