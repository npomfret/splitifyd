# Bug Report: E2E Test Failure Due to Missing `data-testid` on Error Message

**Date**: 2025-08-16
**Status**: ✅ RESOLVED
**Priority**: High
**Component**: E2E Tests, Webapp Components

## 1. Summary

The E2E test designed to verify duplicate user registration (`duplicate-registration.e2e.test.ts`) is failing. The test correctly performs the steps to trigger a "duplicate email" error, and a visual error message is displayed on the screen (confirmed via screenshot). However, the test fails because it cannot locate the error message element using the specified `data-testid` locators.

## 2. Test Failure Details

-   **Test File**: `e2e-tests/src/tests/error-testing/duplicate-registration.e2e.test.ts`
-   **Test Case**: `should prevent duplicate email registration and show error`
-   **Error Message**: `Error: Timed out 5000ms waiting for expect(locator).toBeVisible()`
-   **Failing Locator**: `[data-testid="email-error"], [data-testid="error-message"]`

The test fails on this line:
```typescript
// e2e-tests/src/tests/error-testing/duplicate-registration.e2e.test.ts:68
await expect(errorElement).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ERROR_DISPLAY });
```

## 3. Root Cause Analysis

The investigation traced the code from the test case to the React component responsible for rendering the error message.

1.  The test calls the `registerPage.getEmailError()` method to get the locator for the error message.
2.  The `RegisterPage` page object (`e2e-tests/src/pages/register.page.ts`) defines this method as:
    ```typescript
    // e2e-tests/src/pages/register.page.ts
    getEmailError() {
      return this.page.locator('[data-testid="email-error"], [data-testid="error-message"]');
    }
    ```
3.  The UI for the registration page is rendered by `webapp-v2/src/pages/RegisterPage.tsx`. This component passes any authentication errors to the `AuthForm` component.
4.  The `AuthForm` component (`webapp-v2/src/components/auth/AuthForm.tsx`) then uses the `ErrorMessage` component to display the error.
5.  The `ErrorMessage` component (`webapp-v2/src/components/auth/ErrorMessage.tsx`) renders the error message inside a `div`, but **it does not have a `data-testid` attribute**.

**The core issue is a mismatch between the test automation infrastructure and the application's frontend code.** The test expects a `data-testid` for stable element location, but the component does not provide one.

### Evidence: The `ErrorMessage` Component

```tsx
// webapp-v2/src/components/auth/ErrorMessage.tsx

export function ErrorMessage({ error, className = '' }: ErrorMessageProps) {
  if (!error) return null;

  return (
    // THIS DIV IS MISSING A DATA-TESTID
    <div class={`text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3 ${className}`}>
      <div class="flex">
        <div class="flex-shrink-0">
          {/* ... svg icon ... */}
        </div>
        <div class="ml-2">
          <p>{error}</p>
        </div>
      </div>
    </div>
  );
}
```

## 4. Recommended Fix

To fix the test and align the component with project testing standards, a `data-testid` attribute should be added to the main `div` in the `ErrorMessage.tsx` component.

**File to Modify**: `webapp-v2/src/components/auth/ErrorMessage.tsx`

**Suggested Change**:

```tsx
// webapp-v2/src/components/auth/ErrorMessage.tsx

export function ErrorMessage({ error, className = '' }: ErrorMessageProps) {
  if (!error) return null;

  return (
    <div 
      class={`text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3 ${className}`}
      data-testid="error-message" // <-- ADD THIS LINE
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-2">
          <p>{error}</p>
        </div>
      </div>
    </div>
  );
}
```

Adding `data-testid="error-message"` will allow the existing test locator to find the element, resolving the test failure and making the error component more robust for future testing.

## 5. Resolution

**Date**: 2025-01-16
**Fixed by**: Claude Code Assistant

### Implementation
Added `data-testid="error-message"` attribute to the main `div` element in `/Users/nickpomfret/projects/splitifyd-1/webapp-v2/src/components/auth/ErrorMessage.tsx` at line 12.

### Verification
- ✅ **E2E Test Results**: All 3 tests in `duplicate-registration.e2e.test.ts` now pass
- ✅ **Syntax Compliance**: Confirmed proper Preact syntax usage
- ✅ **No Side Effects**: Change only adds test identifier, no functional impact

The bug has been successfully resolved and the E2E test suite is now stable.
