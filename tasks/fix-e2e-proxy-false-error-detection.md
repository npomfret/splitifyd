# Fix E2E Test Proxy False Error Detection

## Problem

The E2E test error proxy is incorrectly identifying normal UI elements as errors, specifically monetary amounts displayed in red/negative styling. This causes misleading error reports during test failures.

### Current Behavior

When a test fails, the proxy's `pageState.visibleErrors` array includes text that appears to be styled as an error (likely red text) but is actually legitimate UI content. For example:

- Amount owed displays like "$25.00" (shown in red to indicate debt)
- Negative balances or amounts due
- Other financial indicators that use error-like styling for emphasis

### Example from Test Failure

```
Page errors: $25.00: {
  ...
  "pageState": {
    ...
    "visibleErrors": [
      "$25.00"  // This is not an error - it's a balance/amount owed
    ],
    ...
  }
}
```

## Root Cause

The error detection logic appears to be using CSS styling (likely color or class names) to identify errors, rather than semantic HTML attributes or specific error containers. This causes it to pick up any text styled similarly to errors, even when it's legitimate content.

## Requirements

The error proxy should:

1. **Accurately detect ONLY actual errors:**
   - Form validation errors
   - API error messages
   - System error notifications
   - Toast/alert messages indicating failures

2. **Ignore legitimate UI elements that may use similar styling:**
   - Monetary amounts (positive/negative balances)
   - Status indicators
   - Warning text that isn't an error
   - Emphasized content using red/danger colors

3. **Use semantic detection methods:**
   - Look for specific error containers (e.g., elements with `role="alert"`)
   - Check for error-specific class names (e.g., `.error-message`, `.field-error`)
   - Identify error text by parent container context
   - Use data attributes like `data-error` or `data-testid="error-*"`

## Proposed Solution

Update the error detection logic in the proxy to be more selective:

1. **Semantic HTML detection:**
   - Elements with `role="alert"` or `role="status"` 
   - Elements with `aria-invalid="true"`
   - Elements within form validation containers

2. **Specific class/ID patterns:**
   - Classes explicitly containing "error", "alert", "invalid"
   - Exclude classes like "amount", "balance", "owed", "debt"

3. **Context-aware detection:**
   - Check parent elements for form/validation context
   - Verify text content patterns (e.g., starts with "Error:", "Warning:")
   - Exclude numeric-only content unless within error containers

4. **Add test-specific markers:**
   - Add `data-error="true"` to actual error messages in the app
   - Use `data-testid="error-*"` for error containers
   - This provides explicit control over what the proxy considers an error

## Impact

- **Current:** False positives in error reporting make debugging harder and create confusion
- **After Fix:** Clear, accurate error reporting that only shows genuine application errors

## Test Plan

1. Verify proxy correctly identifies:
   - Form validation errors
   - API error responses shown to users
   - System error messages

2. Verify proxy ignores:
   - Balance amounts (positive and negative)
   - Amount owed displays
   - Status indicators using red/danger colors
   - Any legitimate UI content with error-like styling

3. Add specific test cases for the proxy error detection logic

## Priority

Medium-High - This affects developer experience and test debugging efficiency, but doesn't block functionality.