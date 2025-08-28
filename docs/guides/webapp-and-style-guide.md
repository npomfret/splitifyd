# Error Display Patterns & Semantic Attributes

This guide establishes the standards for error display patterns and semantic attributes to ensure proper error detection in e2e tests while avoiding false positives from financial displays.

---

## The Problem

Our e2e test error detection system was incorrectly flagging red financial amounts (like "$25 owed") as errors because it used broad CSS selectors (`.text-red-500`, `.text-red-600`) to detect error messages. This caused false positive error reports when red text was used legitimately for balance/debt displays.

## The Solution

**Two-tier semantic attribute system:**

1. **Error messages** must have semantic attributes: `role="alert"` and/or `data-testid="*error*"`
2. **Financial displays** must have semantic attributes: `data-financial-amount`, `data-balance`, or `data-debt`

---

## Error Display Requirements

### ✅ Required Semantic Attributes for ALL Error Displays

**Every error message MUST include one or both of these attributes:**

```tsx
// Option 1: Use role="alert" (preferred for accessibility)
<p className="text-sm text-red-600" role="alert">
    {validationError}
</p>

// Option 2: Use data-testid with "error" prefix
<p className="text-sm text-red-600" data-testid="validation-error-fieldname">
    {validationError}
</p>

// Option 3: Use both (recommended)
<p className="text-sm text-red-600" role="alert" data-testid="validation-error-fieldname">
    {validationError}
</p>
```

### Error Types & Required Patterns

#### 1. Form Validation Errors

```tsx
// Field validation errors
{validationErrors.email && (
    <p className="text-sm text-red-600" role="alert" data-testid="validation-error-email">
        {validationErrors.email}
    </p>
)}

// Input component errors
<input 
    className={`... ${error ? 'border-red-500' : 'border-gray-300'}`}
    aria-invalid={!!error}
    aria-describedby={error ? `${id}-error` : undefined}
/>
{error && (
    <p id={`${id}-error`} className="text-sm text-red-600" role="alert" data-testid="input-error-message">
        {error}
    </p>
)}
```

#### 2. Page-Level Error Displays

```tsx
// Error page headings
<h2 className="text-xl font-semibold text-red-600" role="alert" data-testid="page-error-title">
    Error
</h2>

// Error message containers
<div className="bg-red-50 border border-red-200 rounded-lg p-3">
    <p className="text-sm text-red-700" role="alert" data-testid="page-error-message">
        {errorMessage}
    </p>
</div>
```

#### 3. Component-Specific Errors

```tsx
// Comments section errors
<p className="text-sm text-red-700" role="alert" data-testid="comments-error-message">
    {error}
</p>

// Modal/dialog errors  
<p className="text-sm text-red-800" role="alert" data-testid="create-group-error-message">
    {error}
</p>

// API/network errors
<div className="bg-red-50 border border-red-200 rounded-md p-3">
    <p className="text-sm text-red-800" role="alert" data-testid="api-error-message">
        {error}
    </p>
</div>
```

---

## Financial Display Requirements

### ✅ Required Semantic Attributes for Financial Displays

**Any financial amount displayed in red MUST include a semantic attribute:**

```tsx
// Debt amounts
<span className="text-red-600" data-financial-amount="debt">
    {formatCurrency(debt.amount, currency)}
</span>

// Balance displays
<div className="text-red-600" data-financial-amount="balance">
    {balanceText}
</div>

// Split amounts (when user owes money)
<p className="text-red-600" data-financial-amount="split">
    ${amount.toFixed(2)}
</p>
```

### Financial Display Types

| Type | Attribute | Description |
|------|-----------|-------------|
| **Debt** | `data-financial-amount="debt"` | Money owed to others |
| **Balance** | `data-financial-amount="balance"` | Net balance displays |  
| **Split** | `data-financial-amount="split"` | Individual expense splits |
| **Settlement** | `data-financial-amount="settlement"` | Settlement amounts |

### Financial Component Examples

```tsx
// BalanceSummary.tsx
<span className="text-red-600" data-financial-amount="debt">
    {formatCurrency(debt.amount, debt.currency)}
</span>

// SplitBreakdown.tsx  
<p className={`font-semibold ${isOwing ? 'text-red-600' : 'text-gray-900'}`} 
   data-financial-amount="split">
    ${split.amount.toFixed(2)}
</p>

// GroupCard.tsx
<div className="text-red-600" data-financial-amount="balance">
    {balanceDisplay.text}
</div>
```

---

## E2E Test Error Detection Logic

The updated error detection system in `e2e-tests/src/utils/page-state-collector.ts`:

### ✅ Semantic Error Selectors (Preferred)

```javascript
const errorSelectors = [
    // Primary semantic selectors
    '[role="alert"]:visible',
    '[data-testid*="error"]:visible', 
    '[data-testid*="validation-error"]:visible',
    
    // Form validation patterns
    'input ~ p.text-red-500:visible, input ~ p.text-red-600:visible',
    'textarea ~ p.text-red-500:visible, textarea ~ p.text-red-600:visible',
    
    // Legacy selectors (for backward compatibility)
    '.error-message:visible',
    '.alert-error:visible',
];
```

### ❌ Financial Display Exclusions

```javascript
const financialSelectors = [
    '[data-financial-amount]:visible',
    '[data-balance]:visible',
    '[data-debt]:visible', 
];

// Elements matching these selectors are excluded from error detection
```

---

## Migration Checklist

### For New Components

- [ ] All error messages include `role="alert"` and/or `data-testid="*error*"`
- [ ] All red financial amounts include `data-financial-amount` attributes
- [ ] Form validation follows input error patterns
- [ ] Error messages are accessible with proper ARIA attributes

### For Existing Components

1. **Audit existing error displays:**
   ```bash
   grep -r "text-red-" webapp-v2/src/components/ webapp-v2/src/pages/
   ```

2. **Add semantic attributes to errors:**
   - Add `role="alert"` to error messages
   - Add `data-testid="*error*"` for test targeting

3. **Add semantic attributes to financial displays:**
   - Add `data-financial-amount` to red balance/debt displays
   - Verify e2e tests no longer flag them as errors

4. **Test error detection:**
   - Run e2e tests with actual errors to ensure detection works  
   - Run e2e tests with financial displays to ensure no false positives

---

## Code Examples

### ❌ Before (Problematic)

```tsx
// No semantic attributes - will be detected as error by broad selectors
<p className="text-sm text-red-600">{validationError}</p>

// Red financial amount without semantic attributes - false positive
<span className="text-red-600">${25.00}</span>
```

### ✅ After (Correct)

```tsx
// Error with proper semantic attributes
<p className="text-sm text-red-600" role="alert" data-testid="validation-error-amount">
    {validationError}
</p>

// Financial amount with semantic attribute - excluded from error detection
<span className="text-red-600" data-financial-amount="debt">
    ${25.00}
</span>
```

---

## Testing Guidelines

### Manual Testing

1. **Error Display Test:**
   - Trigger form validation errors
   - Verify errors appear in e2e test error collection
   - Verify errors have proper semantic attributes

2. **Financial Display Test:**
   - Display pages with red financial amounts (debts, balances)
   - Verify amounts do NOT appear in e2e test error collection
   - Verify amounts have proper semantic attributes

### Automated Testing

```typescript
// Example e2e test validation
test('error detection excludes financial amounts', async ({ page }) => {
    // Navigate to page with red debt amounts
    await page.goto('/groups/123');
    
    // Trigger error collection (simulates our proxy system)
    const errors = await collectVisibleErrors(page);
    
    // Verify financial amounts not detected as errors
    expect(errors).not.toContain('$25.00');
    expect(errors).not.toContain('You owe $15.50');
    
    // Verify actual errors still detected
    await page.getByRole('button', { name: 'Submit' }).click();
    const errorsAfterSubmit = await collectVisibleErrors(page);
    expect(errorsAfterSubmit).toContain('Amount is required');
});
```

---

## Enforcement

### Code Review Requirements

- [ ] All new error displays include proper semantic attributes
- [ ] All new red financial displays include exclusion attributes  
- [ ] No broad CSS selector error detection patterns
- [ ] Error messages follow accessibility guidelines (`role="alert"`)

### Linting Rules (Future)

Consider adding ESLint rules to enforce:
- `role="alert"` on elements with error-related text/classes
- `data-financial-amount` on red financial displays
- Proper `aria-describedby` relationships for form errors

### CI/CD Integration

E2E tests will fail if:
- Red text is flagged as error without proper semantic attributes
- Actual UI errors are not detected due to missing semantic attributes

---

## Summary

**The golden rule:** 
- **Errors** = `role="alert"` + `data-testid="*error*"`  
- **Financial red text** = `data-financial-amount="type"`

This ensures precise e2e error detection with zero false positives from financial displays.

---

## Webapp Development Best Practices

This section outlines best practices for building robust, testable, and maintainable web applications, with a focus on handling real-time data from Firebase.

### 1. Testability Best Practices

To ensure pages and components are easy to test, follow these guidelines:

*   **Decouple Data Logic from UI:** Separate data fetching, state management, and business logic into dedicated stores (e.g., using `@preact/signals`), custom hooks, or service modules. UI components should primarily focus on rendering and consuming data from these decoupled layers.
*   **Mockable Dependencies:** Design modules and functions so that their dependencies (e.g., Firebase instances, API clients, external services) can be easily mocked or injected during testing. Avoid direct global access to unmockable resources.
*   **Clear State Transitions:** Components should react to well-defined state transitions (e.g., `loading`, `data`, `error`). This simplifies testing of different UI states and user interactions.
*   **Avoid Direct DOM Manipulation:** Adhere to the declarative nature of React/Preact. Direct DOM manipulation makes testing difficult and can lead to unpredictable behavior.
*   **Utilize Test IDs:** Continue to use `data-testid` attributes for reliable element selection in unit, component, and end-to-end tests.

### 2. Firebase Realtime Updates & Race Conditions

Firebase's real-time capabilities are powerful but require careful handling to prevent race conditions and ensure data consistency.

*   **Centralized Subscription Management:** Encapsulate `onSnapshot` listeners within dedicated stores or custom hooks (e.g., `commentsStore`). This centralizes the logic for subscribing, unsubscribing, and processing real-time data.
*   **Robust Unsubscription:** Always ensure that `onSnapshot` listeners are properly unsubscribed when they are no longer needed. This is crucial to prevent memory leaks, stale data, and unintended side effects. Implement cleanup functions in `useEffect` hooks or `dispose` methods in stores.
*   **Optimistic Updates with Reconciliation:** When performing write operations that are immediately reflected in the UI (optimistic updates), understand that the `onSnapshot` listener will eventually reconcile the local state with the server's state.
    *   **Simplicity First:** For most cases, let the `onSnapshot` listener drive the UI updates after a write operation. This is the safest approach to avoid complex client-side state management for optimistic updates.
    *   **Server Timestamps:** Rely on server-generated timestamps (e.g., `FieldValue.serverTimestamp()`) for ordering and consistency, especially in real-time collections.
*   **Idempotent Write Operations:** Design write operations to be idempotent where possible. This means that performing the same write operation multiple times will have the same result as performing it once, which helps in handling network retries or concurrent writes.
*   **Firebase Transactions for Atomicity:** For operations that involve reading data, modifying it, and then writing it back (e.g., updating a counter, managing unique IDs), use Firebase Transactions. Transactions ensure that a set of operations is completed atomically, preventing race conditions where multiple clients try to modify the same data concurrently.
*   **Error Handling in Listeners:** Implement comprehensive error handling within `onSnapshot` callbacks. Gracefully manage network disconnections, permission denied errors, and other potential issues to provide a stable user experience.
*   **Avoid Direct Component-Level Listeners:** While possible, avoid setting up `onSnapshot` listeners directly within deeply nested components. Instead, lift the subscription logic to a higher-level store or hook that can manage the data and provide it to consuming components.