# Apply Consistent Form Validation Pattern to All Forms

## Problem
Currently, forms in the application have inconsistent validation patterns. Some forms allow clicking submit buttons even when validation fails, leading to:
- Poor user experience (users click submit but nothing happens)
- E2E tests that fail with unhelpful timeout errors instead of clear validation messages
- Difficulty debugging form issues

## Solution
Apply the improved validation pattern we implemented for the expense form to ALL forms in the application.

## Forms to Update

### 1. Login Form (`webapp-v2/src/pages/LoginPage.tsx`)
- [ ] Add `isFormValid` computed property to check email/password validation
- [ ] Disable submit button when form is invalid
- [ ] Add console.warn for validation failures
- [ ] Show validation errors in real-time

### 2. Registration Form (`webapp-v2/src/pages/RegisterPage.tsx`)
- [ ] Add `isFormValid` computed property
- [ ] Check email, password, displayName, and policy acceptance
- [ ] Disable submit button when invalid
- [ ] Add console.warn for validation failures

### 3. Create Group Form (`webapp-v2/src/pages/CreateGroupPage.tsx`)
- [ ] Add validation for group name (required, min length)
- [ ] Add `isFormValid` computed property
- [ ] Disable submit button when invalid
- [ ] Add console.warn for validation failures

### 4. Edit Group Form (`webapp-v2/src/pages/EditGroupPage.tsx`)
- [ ] Similar to Create Group
- [ ] Validate name and description
- [ ] Disable submit when invalid

### 5. Edit Expense Form (`webapp-v2/src/pages/AddExpensePage.tsx` in edit mode)
- [ ] Already partially done, ensure consistency
- [ ] Verify edit mode uses same validation

### 6. Add Settlement Form (`webapp-v2/src/components/settlements/SettlementForm.tsx`)
- [x] Already has correct pattern but verify it's complete
- [x] Console.warn already added

## Implementation Pattern

### 1. Form Store/Component Pattern
```typescript
// Add to form store or component
get isFormValid(): boolean {
  // Check all required fields
  if (!field1) return false;
  if (!field2) return false;
  
  // Run field validations
  const field1Error = this.validateField('field1');
  if (field1Error) return false;
  
  // Check for any existing validation errors
  return Object.keys(validationErrors).length === 0;
}

// In validation method
if (!isValid) {
  console.warn('[FormName] Validation failed:', errors);
}
```

### 2. Submit Button Pattern
```tsx
<Button
  type="submit"
  variant="primary"
  disabled={isSubmitting || !isFormValid}
>
  Submit
</Button>
```

### 3. Test Helper Pattern
Add to page objects:
```typescript
async expectSubmitButtonEnabled() {
  const submitButton = this.getSubmitButton();
  const isDisabled = await submitButton.isDisabled();
  
  if (isDisabled) {
    const errorMessages = await this.page.locator('.error-message, .text-red-500, [role="alert"]').allTextContents();
    const buttonTitle = await submitButton.getAttribute('title');
    
    let errorDetail = 'Submit button is disabled.';
    if (errorMessages.length > 0) {
      errorDetail += ` Validation errors found: ${errorMessages.join(', ')}`;
    }
    if (buttonTitle) {
      errorDetail += ` Button hint: ${buttonTitle}`;
    }
    
    throw new Error(errorDetail);
  }
  
  return true;
}
```

## Benefits
1. **Better UX**: Users immediately see when they can't submit and why
2. **Better Test Failures**: Tests fail with clear messages like "Submit button disabled. Validation errors: Email is required"
3. **Easier Debugging**: Console warnings provide visibility into validation issues
4. **Consistency**: All forms behave the same way

## Testing
After implementing:
1. Run all E2E tests to ensure they still pass
2. Verify that tests now fail with helpful error messages when validation prevents submission
3. Test each form manually to ensure validation works correctly

## Priority
High - This will significantly improve both user experience and developer experience when debugging test failures.