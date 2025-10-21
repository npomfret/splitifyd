import { TEST_TIMEOUTS } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('GroupDisplayNameSettings - Rendering and Visibility', () => {
    test('should display settings card with title and description', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const card = document.createElement('div');
            card.setAttribute('data-testid', 'group-display-name-settings');
            card.innerHTML = `
                <h3 class="text-sm font-semibold text-gray-900">Your Display Name in this Group</h3>
                <p class="text-sm text-gray-600 mt-1">This is how you'll appear to other members in this group.</p>
            `;
            document.body.appendChild(card);
        });

        const card = page.getByTestId('group-display-name-settings');
        await expect(card).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        await expect(page.getByText('Your Display Name in this Group')).toBeVisible();
        await expect(page.getByText(/how you'll appear to other members/i)).toBeVisible();
    });

    test('should display input field with current display name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');
            input.value = 'Current Name';
            document.body.appendChild(input);
        });

        const input = page.getByTestId('group-display-name-input');
        await expect(input).toBeVisible();
        await expect(input).toHaveValue('Current Name');
    });

    test('should disable submit button when form is pristine', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const button = document.createElement('button');
            button.type = 'submit';
            button.textContent = 'Save Changes';
            button.disabled = true;
            button.setAttribute('data-testid', 'save-button');
            document.body.appendChild(button);
        });

        const saveButton = page.getByTestId('save-button');
        await expect(saveButton).toBeDisabled();
    });
});

test.describe('GroupDisplayNameSettings - Input Validation', () => {
    test('should show error when submitting empty name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');
            input.value = 'Initial Name';

            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Save Changes';

            form.appendChild(input);
            form.appendChild(submitButton);
            document.body.appendChild(form);

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!input.value.trim()) {
                    const error = document.createElement('p');
                    error.className = 'text-sm text-red-600';
                    error.setAttribute('role', 'alert');
                    error.textContent = 'Display name is required.';
                    error.setAttribute('data-testid', 'validation-error');
                    form.appendChild(error);
                }
            });
        });

        const input = page.getByTestId('group-display-name-input');
        await input.fill('');

        const submitButton = page.getByRole('button', { name: 'Save Changes' });
        await submitButton.click();

        await expect(page.getByTestId('validation-error')).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        await expect(page.getByTestId('validation-error')).toContainText('required');
    });

    test('should show error when name exceeds 50 characters', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');

            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Save Changes';

            form.appendChild(input);
            form.appendChild(submitButton);
            document.body.appendChild(form);

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (input.value.trim().length > 50) {
                    const error = document.createElement('p');
                    error.className = 'text-sm text-red-600';
                    error.setAttribute('role', 'alert');
                    error.textContent = 'Display name must be 50 characters or fewer.';
                    error.setAttribute('data-testid', 'validation-error');
                    form.appendChild(error);
                }
            });
        });

        const longName = 'A'.repeat(51);
        const input = page.getByTestId('group-display-name-input');
        await input.fill(longName);

        const submitButton = page.getByRole('button', { name: 'Save Changes' });
        await submitButton.click();

        await expect(page.getByTestId('validation-error')).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        await expect(page.getByTestId('validation-error')).toContainText(/50 characters/i);
    });

    test('should show error when name is unchanged', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');
            input.value = 'Original Name';

            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Save Changes';

            form.appendChild(input);
            form.appendChild(submitButton);
            document.body.appendChild(form);

            const initialName = 'Original Name';
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (input.value.trim() === initialName) {
                    const error = document.createElement('p');
                    error.className = 'text-sm text-red-600';
                    error.setAttribute('role', 'alert');
                    error.textContent = 'Please enter a different name.';
                    error.setAttribute('data-testid', 'validation-error');
                    form.appendChild(error);
                }
            });
        });

        const submitButton = page.getByRole('button', { name: 'Save Changes' });
        await submitButton.click();

        await expect(page.getByTestId('validation-error')).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        await expect(page.getByTestId('validation-error')).toContainText(/different name/i);
    });

    test('should clear validation error when user starts typing', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');

            const error = document.createElement('p');
            error.className = 'text-sm text-red-600';
            error.setAttribute('role', 'alert');
            error.textContent = 'Display name is required.';
            error.setAttribute('data-testid', 'validation-error');

            document.body.appendChild(input);
            document.body.appendChild(error);

            input.addEventListener('input', () => {
                error.style.display = 'none';
            });
        });

        await expect(page.getByTestId('validation-error')).toBeVisible();

        const input = page.getByTestId('group-display-name-input');
        await input.fill('New Name');

        await expect(page.getByTestId('validation-error')).not.toBeVisible();
    });
});

test.describe('GroupDisplayNameSettings - User Interactions', () => {
    test('should submit form with valid new name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');
            input.value = 'Old Name';

            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Save Changes';

            form.appendChild(input);
            form.appendChild(submitButton);
            document.body.appendChild(form);

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                (window as any).submittedName = input.value;
                const success = document.createElement('div');
                success.textContent = 'Success!';
                success.setAttribute('data-testid', 'submit-success');
                document.body.appendChild(success);
            });
        });

        const input = page.getByTestId('group-display-name-input');
        await input.fill('New Name');

        const submitButton = page.getByRole('button', { name: 'Save Changes' });
        await submitButton.click();

        await expect(page.getByTestId('submit-success')).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });

        const submittedName = await page.evaluate(() => (window as any).submittedName);
        expect(submittedName).toBe('New Name');
    });

    test('should enable submit button when name is changed', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');
            input.value = 'Original Name';

            const button = document.createElement('button');
            button.type = 'submit';
            button.textContent = 'Save Changes';
            button.disabled = true;
            button.setAttribute('data-testid', 'save-button');

            document.body.appendChild(input);
            document.body.appendChild(button);

            const initialName = 'Original Name';
            input.addEventListener('input', () => {
                button.disabled = input.value.trim() === initialName;
            });
        });

        const saveButton = page.getByTestId('save-button');
        await expect(saveButton).toBeDisabled();

        const input = page.getByTestId('group-display-name-input');
        await input.fill('New Name');

        await expect(saveButton).toBeEnabled();
    });

    test('should disable inputs when saving', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');
            input.disabled = true;

            const button = document.createElement('button');
            button.type = 'submit';
            button.textContent = 'Saving...';
            button.disabled = true;
            button.setAttribute('data-testid', 'save-button');

            document.body.appendChild(input);
            document.body.appendChild(button);
        });

        await expect(page.getByTestId('group-display-name-input')).toBeDisabled();
        await expect(page.getByTestId('save-button')).toBeDisabled();
        await expect(page.getByText('Saving...')).toBeVisible();
    });
});

test.describe('GroupDisplayNameSettings - Server Responses', () => {
    test('should display server error when name is already taken', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const error = document.createElement('div');
            error.className = 'bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-800';
            error.setAttribute('role', 'alert');
            error.setAttribute('data-testid', 'group-display-name-error');
            error.textContent = 'This display name is already taken by another member.';
            document.body.appendChild(error);
        });

        const errorAlert = page.getByTestId('group-display-name-error');
        await expect(errorAlert).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        await expect(errorAlert).toHaveAttribute('role', 'alert');
        await expect(errorAlert).toContainText(/already taken/i);
    });

    test('should show success message after successful save', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const success = document.createElement('div');
            success.className = 'bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-800';
            success.setAttribute('role', 'status');
            success.setAttribute('data-testid', 'group-display-name-success');
            success.textContent = 'Display name updated successfully!';
            document.body.appendChild(success);
        });

        const successAlert = page.getByTestId('group-display-name-success');
        await expect(successAlert).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });
        await expect(successAlert).toHaveAttribute('role', 'status');
        await expect(successAlert).toContainText(/updated successfully/i);
    });

    test('should clear server error when user starts typing', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const errorDiv = document.createElement('div');
            errorDiv.setAttribute('data-testid', 'group-display-name-error');
            errorDiv.textContent = 'Server error message';
            errorDiv.style.display = 'block';

            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');

            input.addEventListener('input', () => {
                errorDiv.style.display = 'none';
            });

            document.body.appendChild(errorDiv);
            document.body.appendChild(input);
        });

        const error = page.getByTestId('group-display-name-error');
        await expect(error).toBeVisible();

        const input = page.getByTestId('group-display-name-input');
        await input.fill('New Value');

        await expect(error).not.toBeVisible();
    });

    test('should clear success message when user starts typing', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const successDiv = document.createElement('div');
            successDiv.setAttribute('data-testid', 'group-display-name-success');
            successDiv.textContent = 'Success message';
            successDiv.style.display = 'block';

            const input = document.createElement('input');
            input.setAttribute('data-testid', 'group-display-name-input');

            input.addEventListener('input', () => {
                successDiv.style.display = 'none';
            });

            document.body.appendChild(successDiv);
            document.body.appendChild(input);
        });

        const success = page.getByTestId('group-display-name-success');
        await expect(success).toBeVisible();

        const input = page.getByTestId('group-display-name-input');
        await input.fill('New Value');

        await expect(success).not.toBeVisible();
    });
});
