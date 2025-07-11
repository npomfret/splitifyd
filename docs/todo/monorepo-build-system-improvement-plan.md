# Monorepo Build System Improvement Plan

## 1. The Problem

The current build system is fragile and fails on a clean checkout. The command `npm run dev:with-data` fails with the error `Cannot find module '@splitifyd/shared-types'`.

This happens because the `shared-types` package, which is a dependency for both `firebase/functions` and `webapp`, is not built before the packages that depend on it. The current build scripts are manually chained and do not correctly handle the dependency graph of the monorepo.

The use of `file:` dependencies in `package.json` files creates symlinks, but it does not guarantee the build order. This is a significant design flaw in a monorepo setup.

## 2. The Solution: Adopt `npm` Workspaces

To fix this, we will adopt `npm` workspaces, which is the standard, modern way to manage monorepos with `npm`. This will provide a robust and maintainable build process.

The plan involves four main steps:
1.  Introduce `npm` workspaces by creating a root `package.json`.
2.  Hoist common development dependencies to the root.
3.  Refactor build scripts to leverage workspace commands.
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
    "firebase/functions",
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
    "firebase/functions",
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

### Step 3: Refactor Build Scripts

The root `package.json` will contain the primary build script. `npm` will automatically run the build scripts in the correct order based on the dependency graph.

The `dev:with-data` script in `firebase/package.json` will be updated to use the new root build script.

**Before:**
```json
// firebase/package.json
"scripts": {
    "dev:with-data": "rm -f *.log && npm run build && cd functions && npm run build && cd .. && node scripts/generate-firebase-config.js && node scripts/start-with-data.js",
}
```

**After:**
```json
// firebase/package.json
"scripts": {
    "dev:with-data": "rm -f *.log && npm run build --workspace=root && node scripts/generate-firebase-config.js && node scripts/start-with-data.js",
}
```
*Note: The exact command might need adjustment. The key is that the root `npm install` and `npm run build` should be run first.* A better approach might be to move the `dev:with-data` script to the root as well.

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

### Step 5: Implement a "Super Clean" Build

To ensure a completely fresh start, we will introduce a `clean:all` script that removes all generated files, including `node_modules`, `dist` directories, and log files.

This script will be added to the root `package.json`:

```json
// /package.json (with clean:all)
{
  ...
  "scripts": {
    "clean:all": "rm -rf node_modules && npm run clean -w --if-present && rm -f firebase/*.log",
    "build": "npm run build -w --if-present",
    "clean": "npm run clean -w --if-present",
    "test": "npm test -w --if-present"
  },
  ...
}
```

The `dev` and `dev:with-data` scripts in `firebase/package.json` will be updated to use this new script, ensuring a clean slate every time they are run.

**After:**
```json
// firebase/package.json
"scripts": {
    "dev": "npm run clean:all --workspace=root && npm install --workspace=root && npm run dev",
    "dev:with-data": "npm run clean:all --workspace=root && npm install --workspace=root && npm run dev:with-data",
}
```

## 4. New Development Workflow

1.  Run `npm install` from the project root. This will install all dependencies for all workspaces and create the necessary symlinks.
2.  Run `npm run build` from the project root. This will build all workspaces in the correct topological order (`shared-types` first, then `firebase/functions` and `webapp` in parallel).
3.  Run `dev` or `test` commands from the root or from within the specific workspace directory as needed. For example, `cd firebase && npm run dev:with-data`.

This new setup will resolve the build issues, improve developer experience, and provide a solid foundation for future development.
