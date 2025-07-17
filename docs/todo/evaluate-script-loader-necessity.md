# Evaluate Script Loader Component Necessity

## Issue
The script loader component might be unnecessary complexity if scripts are loaded consistently elsewhere.

## Location
`/webapp/src/js/components/script-loader.ts`

## Current Usage
Need to verify where and how this component is actually used.

## Action Required
1. Search for usage of the ScriptLoader component
2. Determine if it provides value over standard script loading
3. Consider if scripts could be loaded more simply
4. Remove if unnecessary or document its purpose clearly

## Questions to Answer
- How many scripts are dynamically loaded?
- Is there complex loading logic that justifies a component?
- Could scripts be loaded statically in HTML or with simpler code?
- Are there timing/dependency requirements that necessitate this component?

## Analysis (2025-07-17)

### Current Implementation
The ScriptLoaderComponent is a sophisticated script loading utility that:
- Extends BaseComponent from the component system
- Provides sequential and parallel loading strategies
- Tracks loaded scripts to prevent duplicates
- Offers promise-based loading with error handling
- Includes three factory methods for specific page loaders

### Usage Found
The component is used in exactly 3 places:
1. `login-init.ts` - Uses `ScriptLoaderComponent.createAuthPageLoader()`
2. `register-init.ts` - Uses `ScriptLoaderComponent.createAuthPageLoader()` 
3. `dashboard-init.ts` - Uses `ScriptLoaderComponent.createDashboardLoader()`

### Scripts Being Loaded
The factory methods define specific script bundles:
- **Auth pages** (login/register): firebase-init.js, api.js, auth.js, logout-handler.js (sequential)
- **Dashboard**: Same as auth + expenses.js, groups.js, dashboard.js (sequential)

### Key Observations
1. **Over-engineered**: The component is 173 lines of code to load a handful of scripts
2. **Limited usage**: Only used in 3 init files with hardcoded script lists
3. **Simpler alternatives exist**: ES6 modules with dynamic imports would be cleaner
4. **No dynamic requirements**: Script lists are static and known at build time
5. **Sequential loading**: While the component supports it, modern browsers handle module dependencies automatically

## Plan

### Decision: Remove the ScriptLoaderComponent

The component adds unnecessary complexity for a simple task. Modern JavaScript provides better alternatives.

### Implementation Steps
1. **Replace with dynamic imports in each init file**
   - Use Promise.all() with dynamic import() for parallel loading
   - Use sequential await for ordered dependencies
   - Let ES6 modules handle deduplication naturally

2. **Update login-init.ts**
   - Remove ScriptLoaderComponent import
   - Replace loader with direct dynamic imports
   - Test login functionality

3. **Update register-init.ts**
   - Same changes as login-init.ts
   - Test registration functionality

4. **Update dashboard-init.ts**
   - Remove ScriptLoaderComponent import
   - Replace loader with direct dynamic imports
   - Test dashboard functionality

5. **Clean up**
   - Delete script-loader.ts
   - Remove export from components/index.ts
   - Run build and tests to ensure nothing breaks

### Example Replacement Pattern
```typescript
// Instead of:
const scriptLoader = ScriptLoaderComponent.createAuthPageLoader();
await scriptLoader.loadScripts();

// Use:
await Promise.all([
  import('./firebase-init.js'),
  import('./api.js'),
  import('./auth.js'),
  import('./logout-handler.js')
]);
```

### Benefits
- Removes 173 lines of unnecessary code
- Uses native browser capabilities
- Simpler to understand and maintain
- No custom component lifecycle to manage
- Better tree-shaking potential