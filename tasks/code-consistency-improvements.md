# Code Consistency Improvements

## Problem Description
A recent analysis of the `webapp-v2` codebase revealed several minor inconsistencies in coding style and patterns. While these do not cause functional bugs, they degrade code quality, make the codebase harder to navigate for new developers, and can lead to confusion.

## Inconsistencies Found

### 1. Inconsistent Export Style for Page Components
Page components in `webapp-v2/src/pages/` do not follow a consistent export style.

-   **Default Export Example:** `webapp-v2/src/pages/GroupDetailPage.tsx` uses `export default function ...`.
-   **Named Export Example:** `webapp-v2/src/pages/DashboardPage.tsx`, `LoginPage.tsx`, and others use `export function ...`.

This forces the use of two different syntaxes for lazy loading in `webapp-v2/src/App.tsx`:
```typescript
// For default exports
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'));

// For named exports
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
```

**Proposed Solution:**
Standardize on one export style for all page components. **Default exports** are recommended for page-level components to simplify dynamic imports.

### 2. Inconsistent Boolean Prop Defaults
In `webapp-v2/src/components/ui/Button.tsx`, boolean props are not handled consistently.

-   The `magnetic` prop defaults to `true` directly in the function signature: `magnetic = true`.
-   Other boolean props like `loading`, `disabled`, and `fullWidth` default to `false`.

**Proposed Solution:**
For consistency, all boolean props that default to `false` should be explicitly defaulted in the function signature.

```typescript
// From
export function Button({
    // ...
    loading = false,
    disabled = false,
    fullWidth = false,
    magnetic = true,
    // ...
})

// No change needed, but this is the consistent pattern to follow.
```
This is a minor stylistic issue, but consistency is key.

### 3. String Literal for `data-testid` Prop
Throughout the UI components (e.g., `Button.tsx`, `Card.tsx`, `Input.tsx`), the `data-testid` prop is defined as a string literal in the interface.

```typescript
interface ButtonProps {
    // ...
    'data-testid'?: string;
}
```

While this is valid TypeScript, it is more conventional in React/Preact ecosystems to define prop names without quotes if they are valid identifiers.

**Proposed Solution:**
Rename the prop to `dataTestId` in the component's `props` interface and use it as `data-testid={dataTestId}` in the JSX. This is a common convention that improves readability.

```typescript
// From
export function Button({ 'data-testid': dataTestId, ... }) {
    return <button data-testid={dataTestId} ... />
}

// To
interface ButtonProps {
    // ...
    dataTestId?: string;
}

export function Button({ dataTestId, ... }) {
    return <button data-testid={dataTestId} ... />
}
```

## Implementation Plan

1.  **Standardize Page Exports:**
    *   [ ] Audit all files in `webapp-v2/src/pages/`.
    *   [ ] Convert all page components that use named exports to use default exports.
    *   [ ] Update `webapp-v2/src/App.tsx` to use the simpler `lazy(() => import(...))` syntax for all pages.

2.  **Standardize `data-testid` Props:**
    *   [ ] Grep for `'data-testid'` in all `.tsx` files in `webapp-v2/src/`.
    *   [ ] For each component, rename the prop in its interface from `'data-testid'` to `dataTestId`.
    *   [ ] Update the component's implementation to destructure `dataTestId` and pass it to the `data-testid` attribute in the JSX.
    *   [ ] Update all call sites of these components to pass `dataTestId` instead of `'data-testid'`. This might be a good opportunity to use `ast-grep` or a similar tool for a large-scale refactoring.

3.  **Review Boolean Prop Defaults:**
    *   [ ] Review `Button.tsx` and other UI components for boolean prop defaults.
    *   [ ] Ensure all boolean props that should default to `false` do so in the function signature for consistency. (This is a low-priority cleanup).
