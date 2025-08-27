# Task: Refactor Test Imports

## 1. Overview

A review of several test files has identified an unconventional pattern where modules are imported from within test methods (`it` blocks) or helper functions. Standard practice is to have all imports declared at the top of the file.

This pattern can make tests harder to read, potentially slow down test execution if modules are re-imported unnecessarily, and hide the module's dependencies from static analysis tools.

## 2. The Problem: Imports Inside Methods

The following files use dynamic `import()` statements within their test logic instead of static `import` statements at the top level.

### 2.1. `e2e-tests/src/__tests__/integration/edge-cases/removed-user-access.spec.ts`

- **Location:** Inside an `it` block.
- **Problematic Code:**
```typescript
it('should prevent access to a group for a removed user', async () => {
    // ...
    const { ApiDriver } = await import('../../../../../packages/test-support/ApiDriver');
    // ...
});
```

### 2.2. `e2e-tests/src/__tests__/integration/error-testing/duplicate-registration.e2e.test.ts`

- **Location:** Inside an `it` block.
- **Problematic Code:**
```typescript
it('should show an error when registering with an existing email', async () => {
    // ...
    const { ApiDriver } = await import('../../../../../packages/test-support/ApiDriver');
    // ...
});
```

### 2.3. `e2e-tests/src/__tests__/integration/normal-flow/comments-realtime.e2e.test.ts`

- **Location:** Inside a local helper function (`addComment`).
- **Problematic Code:**
```typescript
async function addComment(page: Page, comment: string) {
    // ...
    const { ApiDriver } = await import('../../../../../packages/test-support/ApiDriver');
    // ...
}
```

### 2.4. `e2e-tests/src/__tests__/integration/normal-flow/share-link-comprehensive.e2e.test.ts`

- **Location:** Inside a local helper function (`createShareLink`).
- **Problematic Code:**
```typescript
async function createShareLink(page: Page, groupId: string) {
    const { ApiDriver } = await import('../../../../../packages/test-support/ApiDriver');
    // ...
}
```

---

## 3. Recommended Action

For each of the files listed above, the dynamic `import()` should be removed from the method body and replaced with a static `import` statement at the top of the file.

**Example Refactoring:**

**Before:**
```typescript
it('should do something', async () => {
    const { ApiDriver } = await import('../../../../../packages/test-support/ApiDriver');
    const api = new ApiDriver();
    // ...
});
```

**After:**
```typescript
import { ApiDriver } from '../../../../../packages/test-support/ApiDriver';

it('should do something', async () => {
    const api = new ApiDriver();
    // ...
});
```

This change will improve the readability, maintainability, and performance of these tests.
