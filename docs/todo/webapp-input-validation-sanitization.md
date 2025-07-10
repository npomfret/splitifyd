# Webapp Issue: Input Validation and Sanitization

## Issue Description

The application lacks consistent client-side and server-side input validation, trusting user input implicitly.

## Recommendation

Create a shared validation library with functions for common checks (e.g., `isNotEmpty`, `isValidEmail`, `isSafeString`). Enforce client-side validation to provide immediate feedback to users on all forms. Enforce server-side validation where the API re-validates all incoming data to protect against malicious requests that bypass the client-side checks.

## Implementation Suggestions

1.  **Leverage Existing `safe-dom.ts` for Client-Side Validation:**
    *   The `webapp/src/js/utils/safe-dom.ts` already contains a `validateInput` function and `isSafeString`.
    *   **Action:** Systematically apply `validateInput` to all form fields in the webapp.
    *   **Example Usage (in form submission handlers or input event listeners):
        ```typescript
        // webapp/src/js/add-expense.ts (or similar form handling file)
        import { validateInput } from './utils/safe-dom.js';
        import { showFieldError } from './utils/ui-messages.js'; // Assuming this utility is created

        function validateForm(description: string, amount: number, paidBy: string): boolean {
            let isValid = true;

            const descriptionValidation = validateInput(description, { required: true, maxLength: 100 });
            if (!descriptionValidation.valid) {
                showFieldError('description', descriptionValidation.error || 'Description is required');
                isValid = false;
            }

            const amountValidation = validateInput(amount.toString(), { required: true, allowedPattern: /^\d+(\.\d{1,2})?$/, minLength: 1 });
            if (!amountValidation.valid || parseFloat(amountValidation.value || '0') <= 0) {
                showFieldError('amount', amountValidation.error || 'Amount must be greater than 0');
                isValid = false;
            }

            // ... similar validation for other fields

            return isValid;
        }
        ```

2.  **Enforce Server-Side Validation:**
    *   **Action:** Implement robust server-side validation for all API endpoints that accept user input.
    *   **Approach:** This is covered in `docs/todo/api-data-validation-plan.md` which recommends using Zod for schema-driven validation in Firebase Functions.
    *   **Reference:** `docs/todo/api-data-validation-plan.md`

**Next Steps:**
1.  Implement the client-side validation using `safe-dom.ts` for all forms in the webapp.
2.  Ensure the server-side validation plan (`api-data-validation-plan.md`) is implemented to provide a robust backend defense.
