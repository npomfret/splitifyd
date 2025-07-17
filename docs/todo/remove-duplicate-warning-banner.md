# Remove Duplicate Warning Banner Implementation

## Issue
Two separate warning banner implementations exist in the codebase.

## Duplicate Implementations
1. `/webapp/src/js/warning-banner.ts` - Simple manager approach
2. `/webapp/src/js/components/warning-banner.ts` - Component-based approach

## Analysis
The component-based approach in `/webapp/src/js/components/warning-banner.ts` is more robust and follows the established component pattern in the codebase.

## Current Usage Analysis
- The simple `warning-banner.ts` is only imported in `dashboard-init.ts:41`
- The component version is already imported in `dashboard-init.ts:2`, `login-init.ts:2`, and `register-init.ts:2`
- The simple version uses `showWarning`/`hideWarning` from `utils/ui-messages`
- The component version provides the same functionality with better structure

## Implementation Plan

### Step 1: Update dashboard-init.ts
1. Remove the dynamic import of `warning-banner.js` (lines 41-44)
2. Replace with code that uses the already-imported `WarningBannerComponent`
3. Create a wrapper function to match the existing async initialization pattern

### Step 2: Verify firebase-config-manager integration
1. Check that the component version can properly fetch warning banner config
2. Ensure the initialization timing is preserved

### Step 3: Remove obsolete file
1. Delete `/webapp/src/js/warning-banner.ts`
2. Run build to ensure no broken imports

### Step 4: Testing
1. Run `npm run build` to ensure no TypeScript errors
2. Test locally with `npm run dev` to verify warning banner still works
3. Test that warning banners display correctly on dashboard, login, and register pages

## Benefits
- Reduces code duplication
- Consistent component architecture
- Better TypeScript typing and error handling
- More configurable (supports different types, auto-hide, dismissible)