# Monorepo Build System Improvement Plan

## 1. The Problem

The current build system is fragile and fails on a clean checkout. The command `npm run dev:with-data` fails with the error `Cannot find module '@splitifyd/shared-types'`.

This happens because the `shared-types` package, which is a dependency for both `firebase/functions` and `webapp`, is not built before the packages that depend on it. The current build scripts are manually chained and do not correctly handle the dependency graph of the monorepo.

The use of `file:` dependencies in `package.json` files creates symlinks, but it does not guarantee the build order. This is a significant design flaw in a monorepo setup.

## 2. The Solution: Adopt npm Workspaces

To fix this, we will adopt `npm` workspaces, which is the standard, modern way to manage monorepos with `npm`. This will provide a robust and maintainable build process.

The plan involves four main steps:
1.  Introduce `npm` workspaces by creating a root `package.json`.
2.  Hoist common development dependencies to the root.
3.  Refactor build scripts to leverage workspace commands, including a "super clean" option.
4.  Update package dependencies to use the `workspace:` protocol.

## 3. Detailed Implementation Plan

### Step 1: Create a Root `package.json` and Define Workspaces

A `package.json` file will be created in the project root (`/Users/nickpomfret/projects/splitifyd`). This file will define the packages (workspaces) in our monorepo.

```json
// /package.json
{
  "name": "splitifyd-monorepo",
  "private": true,
  "workspaces": [
    "shared-types",
    "firebase",
    "webapp"
  ],
  "scripts": {
    "build": "npm run build -w --if-present",
    "clean": "npm run clean -w --if-present",
    "test": "npm test -w --if-present"
  }
}
```

### Step 2: Hoist Dependencies

To ensure consistency and simplify dependency management, we will move common development dependencies to the root `package.json`.

```json
// /package.json (with devDependencies)
{
  "name": "splitifyd-monorepo",
  "private": true,
  "workspaces": [
    "shared-types",
    "firebase",
    "webapp"
  ],
  "scripts": {
    "build": "npm run build -w --if-present",
    "clean": "npm run clean -w --if-present",
    "test": "npm test -w --if-present"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.19.2"
  }
}
```
*Note: We will need to analyze all `package.json` files to identify all common dependencies and their most appropriate versions.*

### Step 3: Refactor Build Scripts and Implement "Super Clean"

The root `package.json` will contain the primary build and clean scripts. We will add a `super-clean` script to the root to remove all build artifacts, logs, and `node_modules` directories from the entire project. The `dev` and `dev:with-data` scripts will be moved to the root and updated to use this clean script, ensuring a completely fresh start every time.

```json
// /package.json (with all scripts)
{
  "name": "splitifyd-monorepo",
  "private": true,
  "workspaces": [
    "shared-types",
    "firebase",
    "webapp"
  ],
  "scripts": {
    "super-clean": "rm -rf node_modules && rm -rf packages/*/node_modules && rm -rf packages/*/*/node_modules && npm run clean -ws --if-present && rm -f firebase/*.log",
    "dev": "npm run super-clean && npm install && npm run build && cd firebase && npm run dev",
    "dev:with-data": "npm run super-clean && npm install && npm run build && cd firebase && npm run dev:with-data",
    "build": "npm run build -ws --if-present",
    "clean": "npm run clean -ws --if-present",
    "test": "npm test -ws --if-present"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.19.2"
  }
}
```

The old `dev` and `dev:with-data` scripts in `firebase/package.json` should be removed to avoid confusion.

### Step 4: Update `package.json` Dependencies

We will replace the `file:` protocol with the `workspace:` protocol for all internal package dependencies. This makes the relationship between packages explicit to `npm`.

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
    "@splitifyd/shared-types": "workspace:^",
    ...
}
```
This will be done for `webapp/package.json` as well.

## 4. New Development Workflow

1.  **Initial Setup:** Run `npm install` from the project root. This will install all dependencies for all workspaces and create the necessary symlinks.
2.  **Development:** Run `npm run dev` or `npm run dev:with-data` from the project root. This will perform a "super clean," reinstall dependencies, and then build everything in the correct order before starting the development server.
3.  **Testing:** Run `npm test` from the project root to run all tests, or `npm test -w <workspace_name>` to test a specific package.

This new setup will resolve the build issues, improve developer experience, and provide a solid foundation for future development.