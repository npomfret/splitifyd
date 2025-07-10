# Webapp Issue: Redundant Logic - UI Message Utilities

## Issue Description

Functions like `showMessage`, `showError`, `hideError`, `clearErrors`, and `showSuccess` are duplicated across `add-expense.ts`, `app-init.ts`, `group-detail.ts`, `join-group.ts`, and `reset-password.ts`.

## Recommendation

Create a single utility file (e.g., `webapp/src/js/utils/ui-messages.ts`) to house all common UI message display functions.

## Implementation Suggestions

1.  **Create `webapp/src/js/utils/ui-messages.ts`:**

    ```typescript
    // webapp/src/js/utils/ui-messages.ts

    /**
     * Displays a general message to the user.
     * @param message The message to display.
     * @param type The type of message (e.g., 'info', 'success', 'error').
     * @param duration The duration in milliseconds for which the message should be visible. Set to 0 for indefinite.
     */
    export function showMessage(message: string, type: 'info' | 'success' | 'error' = 'info', duration: number = 3000): void {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.classList.add('show');
        }, 10);

        if (duration > 0) {
            setTimeout(() => {
                messageDiv.classList.remove('show');
                setTimeout(() => {
                    messageDiv.remove();
                }, 300);
            }, duration);
        }
    }

    /**
     * Displays an error message.
     * @param message The error message to display.
     * @param duration The duration in milliseconds for which the message should be visible. Set to 0 for indefinite.
     */
    export function showError(message: string, duration: number = 5000): void {
        showMessage(message, 'error', duration);
    }

    /**
     * Hides any currently displayed warning/error message.
     */
    export function hideError(): void {
        const bannerElement = document.getElementById('warningBanner'); // Assuming warningBanner is used for general errors
        if (bannerElement) {
            bannerElement.classList.add('hidden');
        }
    }

    /**
     * Clears all field-specific error messages within a form.
     * @param formElement The HTMLFormElement to clear errors from.
     */
    export function clearFieldErrors(formElement: HTMLFormElement): void {
        formElement.querySelectorAll('.form-error').forEach(error => {
            error.textContent = '';
        });
        formElement.querySelectorAll('.form-input--error').forEach(input => {
            input.classList.remove('form-input--error');
        });
    }

    /**
     * Displays a field-specific error message.
     * @param fieldName The name or ID of the field.
     * @param message The error message.
     */
    export function showFieldError(fieldName: string, message: string): void {
        const errorElement = document.getElementById(`${fieldName}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';

            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Displays a success message, typically for form submissions.
     * @param formElement The form element related to the success.
     * @param message The success message.
     */
    export function showFormSuccess(formElement: HTMLFormElement, message: string): void {
        let successContainer = formElement.querySelector<HTMLDivElement>('.form-success--general');

        if (!successContainer) {
            successContainer = document.createElement('div');
            successContainer.className = 'form-success form-success--general';
            successContainer.setAttribute('role', 'alert');
            const submitButton = formElement.querySelector('button');
            if (submitButton) {
                formElement.insertBefore(successContainer, submitButton);
            }
        }

        successContainer.textContent = message;
        successContainer.setAttribute('aria-live', 'polite');

        setTimeout(() => {
            successContainer?.remove();
        }, 3000);
    }
    ```

2.  **Update Existing Files to Use the New Utilities:**
    *   **`add-expense.ts`:** Replace `showMessage` and `showFieldError` with imports from `ui-messages.ts`.
    *   **`app-init.ts`:** Replace `showError` and `hideError` with imports from `ui-messages.ts`.
    *   **`group-detail.ts`:** Replace `showMessage` with import from `ui-messages.ts`.
    *   **`join-group.ts`:** Replace `showMessage` with import from `ui-messages.ts`.
    *   **`reset-password.ts`:** Replace `clearErrors`, `showError`, and `showSuccess` with imports from `ui-messages.ts`.
    *   **`auth.ts`:** Replace `showFormError`, `showSuccessMessage`, `showFieldError`, `clearFieldError` with imports from `ui-messages.ts`.

3.  **Verify with Build and Tests:**
    Run `npm run build` and `npm test` in the `webapp` directory to ensure no new type errors are introduced and existing tests pass.
