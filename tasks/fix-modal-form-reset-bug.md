# Task: Fix Modal Form Reset Bug Pattern

## Bug Description

### The Problem
We discovered a critical bug in the `EditGroupModal` component where form fields would reset to their original values when real-time updates arrived. This happened because the component's `useEffect` hook was watching the `group` prop and resetting all form state whenever it changed - even while the user was actively editing.

### Code Pattern (BUGGY)
```typescript
// BAD: This pattern resets form on prop changes
useEffect(() => {
    if (isOpen) {
        setFormField(prop.value);
        setOtherField(prop.otherValue);
    }
}, [isOpen, prop]); // <- Bug: watching 'prop' causes resets
```

### The Fix
```typescript
// GOOD: Only reset when modal opens
useEffect(() => {
    if (isOpen) {
        setInitialValue(prop.value);
        setFormField(prop.value);
    }
}, [isOpen]); // <- Only watch isOpen

// Track changes against initial values, not current props
const hasChanges = formField !== initialValue;
```

## Impact on Tests

### Test Failures
The bug caused intermittent E2E test failures with these symptoms:
1. Test fills form fields with new values
2. Real-time update arrives (group prop changes)
3. Form fields reset to original values
4. "Save Changes" button becomes disabled (because `hasChanges` is false)
5. Test fails with "element is not enabled" when trying to click Save

### Error Messages
```
TimeoutError: locator.click: Timeout 1500ms exceeded.
- element is not enabled
```

Screenshot would show the modal with **original values** despite the test having entered new values.

## Task: Find Similar Bugs

### Search Criteria
Look for components (especially modals and forms) that:

1. **useEffect with form state setters watching props**
   - Pattern: `useEffect` that sets form state and includes props in dependencies
   - Risk: Form resets when props update

2. **Modal components that receive entity props**
   - Components like `Edit*Modal`, `Update*Form`, `*SettingsModal`
   - These often receive current data as props that might update via real-time sync

3. **Form components without initial value tracking**
   - Forms that compare `currentValue !== prop.value` for `hasChanges`
   - Should compare against initial values captured when form opens

### Specific Patterns to Search For

```typescript
// Search for these patterns:

// 1. useEffect with isOpen AND entity prop
useEffect(() => {
    if (isOpen) {
        setState(entity.field);
    }
}, [isOpen, entity]); // POTENTIAL BUG

// 2. hasChanges comparing against current prop
const hasChanges = formValue !== entity.value; // POTENTIAL BUG
// Should be: formValue !== initialValue

// 3. Form state reset on prop change
useEffect(() => {
    setFormState(prop);
}, [prop]); // POTENTIAL BUG if in an edit form
```

### Components to Investigate

Priority areas to check:
1. **Modal components** in `webapp-v2/src/components/`
   - Any `Edit*Modal.tsx` files
   - Any `Update*Modal.tsx` files
   - Settings or configuration modals

2. **Form components** that:
   - Receive entity data as props
   - Are used for editing existing data
   - Can be open while real-time updates occur

3. **Expense and Settlement forms**
   - These deal with frequently updating data
   - Check `ExpenseEditForm`, `SettlementEditForm`, etc.

### Expected Findings

We expect to find similar bugs in:
- Other edit modals (user settings, expense edit, etc.)
- Any form that can remain open during real-time updates
- Components that mix controlled form state with prop-based initialization

### Remediation

For each instance found:
1. Separate initial values from current props
2. Only reset form when modal/form opens, not on prop changes
3. Track `hasChanges` against initial values, not current props
4. Add defensive test checks similar to what we added for `EditGroupModal`

### Testing Strategy

For each fixed component:
1. Add E2E test that:
   - Opens the edit form
   - Modifies values
   - Simulates a real-time update (or waits for one)
   - Verifies values persist
   - Saves successfully

2. Add defensive checks in page objects to catch resets immediately

## Success Criteria

- [ ] All modal/form components audited
- [ ] Similar bugs identified and documented
- [ ] Fixes applied following the pattern established
- [ ] Tests added to prevent regression
- [ ] No flaky tests related to form resets