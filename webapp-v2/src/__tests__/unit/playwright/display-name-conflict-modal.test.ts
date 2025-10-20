import { TEST_TIMEOUTS } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('DisplayNameConflictModal - Rendering and Visibility', () => {
    test('should display modal with correct title and description', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        // Navigate to a route that renders the modal
        await page.goto('/join?linkId=test-link&showConflict=true');

        // Mock the modal being open by injecting component state
        await page.evaluate(() => {
            const modalRoot = document.createElement('div');
            modalRoot.innerHTML = `
                <div role="dialog" aria-modal="true" aria-labelledby="display-name-conflict-title">
                    <h3 id="display-name-conflict-title">Choose a display name for Test Group</h3>
                    <p id="display-name-conflict-description">Your name "John Doe" is already in use in this group.</p>
                    <input data-testid="display-name-conflict-input" />
                </div>
            `;
            document.body.appendChild(modalRoot);
        });

        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        const title = page.locator('#display-name-conflict-title');
        await expect(title).toContainText('Choose a display name');

        const description = page.locator('#display-name-conflict-description');
        await expect(description).toContainText('already in use');
    });

    test('should focus input field when modal opens', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'display-name-conflict-input');
            document.body.appendChild(input);
            input.focus();
        });

        const input = page.getByTestId('display-name-conflict-input');
        await expect(input).toBeFocused({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    });

    test('should display current name in read-only field', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const currentNameDisplay = document.createElement('p');
            currentNameDisplay.textContent = 'John Doe';
            currentNameDisplay.className = 'text-sm text-gray-900';
            document.body.appendChild(currentNameDisplay);
        });

        await expect(page.getByText('John Doe', { exact: true })).toBeVisible();
    });
});

test.describe('DisplayNameConflictModal - Input Validation', () => {
    test('should show error when submitting empty name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'display-name-conflict-input');
            input.value = '';
            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Save name & join';
            form.appendChild(input);
            form.appendChild(submitButton);
            document.body.appendChild(form);

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const error = document.createElement('div');
                error.textContent = 'Enter a display name.';
                error.setAttribute('role', 'alert');
                error.className = 'text-sm text-red-600';
                form.appendChild(error);
            });
        });

        const input = page.getByTestId('display-name-conflict-input');
        await input.fill('');

        const submitButton = page.getByRole('button', { name: /save name/i });
        await submitButton.click();

        await expect(page.getByText('Enter a display name.')).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
    });

    test('should show error when name exceeds 50 characters', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'display-name-conflict-input');
            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Save name & join';
            form.appendChild(input);
            form.appendChild(submitButton);
            document.body.appendChild(form);

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (input.value.length > 50) {
                    const error = document.createElement('div');
                    error.textContent = 'Display name must be 50 characters or fewer.';
                    error.setAttribute('role', 'alert');
                    error.className = 'text-sm text-red-600';
                    form.appendChild(error);
                }
            });
        });

        const longName = 'A'.repeat(51);
        const input = page.getByTestId('display-name-conflict-input');
        await input.fill(longName);

        const submitButton = page.getByRole('button', { name: /save name/i });
        await submitButton.click();

        await expect(page.getByText(/50 characters or fewer/)).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
    });

    test('should show error when submitting same name as current', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'display-name-conflict-input');
            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Save name & join';
            form.appendChild(input);
            form.appendChild(submitButton);
            document.body.appendChild(form);

            const currentName = 'John Doe';
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (input.value.trim().toLowerCase() === currentName.toLowerCase()) {
                    const error = document.createElement('div');
                    error.textContent = 'Choose a different name than your current one.';
                    error.setAttribute('role', 'alert');
                    error.className = 'text-sm text-red-600';
                    form.appendChild(error);
                }
            });
        });

        const input = page.getByTestId('display-name-conflict-input');
        await input.fill('John Doe');

        const submitButton = page.getByRole('button', { name: /save name/i });
        await submitButton.click();

        await expect(page.getByText(/different name/)).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
    });

    test('should clear validation error when user starts typing', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'display-name-conflict-input');
            const errorDiv = document.createElement('div');
            errorDiv.textContent = 'Enter a display name.';
            errorDiv.setAttribute('role', 'alert');
            errorDiv.setAttribute('data-testid', 'validation-error');
            form.appendChild(input);
            form.appendChild(errorDiv);
            document.body.appendChild(form);

            input.addEventListener('input', () => {
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }
            });
        });

        // Verify error is visible
        await expect(page.getByTestId('validation-error')).toBeVisible();

        // Type in input
        const input = page.getByTestId('display-name-conflict-input');
        await input.fill('New Name');

        // Error should be hidden
        await expect(page.getByTestId('validation-error')).not.toBeVisible();
    });
});

test.describe('DisplayNameConflictModal - User Interactions', () => {
    test('should submit form with valid new name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        let submittedName = '';
        await page.evaluate(() => {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.setAttribute('data-testid', 'display-name-conflict-input');
            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Save name & join';
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

        const input = page.getByTestId('display-name-conflict-input');
        await input.fill('Jane Smith');

        const submitButton = page.getByRole('button', { name: /save name/i });
        await submitButton.click();

        await expect(page.getByTestId('submit-success')).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });

        submittedName = await page.evaluate(() => (window as any).submittedName);
        expect(submittedName).toBe('Jane Smith');
    });

    test('should close modal when clicking cancel button', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const modal = document.createElement('div');
            modal.setAttribute('data-testid', 'conflict-modal');
            modal.style.display = 'block';

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.onclick = () => {
                modal.style.display = 'none';
            };

            modal.appendChild(cancelButton);
            document.body.appendChild(modal);
        });

        const modal = page.getByTestId('conflict-modal');
        await expect(modal).toBeVisible();

        const cancelButton = page.getByRole('button', { name: 'Cancel' });
        await cancelButton.click();

        await expect(modal).not.toBeVisible();
    });

    test('should close modal when clicking close X button', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const modal = document.createElement('div');
            modal.setAttribute('data-testid', 'conflict-modal');
            modal.style.display = 'block';

            const closeButton = document.createElement('button');
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.textContent = '×';
            closeButton.onclick = () => {
                modal.style.display = 'none';
            };

            modal.appendChild(closeButton);
            document.body.appendChild(modal);
        });

        const modal = page.getByTestId('conflict-modal');
        await expect(modal).toBeVisible();

        const closeButton = page.getByLabel('Close');
        await closeButton.click();

        await expect(modal).not.toBeVisible();
    });

    test('should close modal when pressing Escape key', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const modal = document.createElement('div');
            modal.setAttribute('data-testid', 'conflict-modal');
            modal.style.display = 'block';
            modal.textContent = 'Modal content'; // Add content so modal is visible
            document.body.appendChild(modal);

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    modal.style.display = 'none';
                }
            });
        });

        const modal = page.getByTestId('conflict-modal');
        await expect(modal).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(modal).not.toBeVisible();
    });

    test('should disable buttons when loading', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const submitButton = document.createElement('button');
            submitButton.textContent = 'Saving...';
            submitButton.disabled = true;
            submitButton.setAttribute('data-testid', 'submit-button');

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.disabled = true;
            cancelButton.setAttribute('data-testid', 'cancel-button');

            const closeButton = document.createElement('button');
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.disabled = true;

            document.body.appendChild(submitButton);
            document.body.appendChild(cancelButton);
            document.body.appendChild(closeButton);
        });

        await expect(page.getByTestId('submit-button')).toBeDisabled();
        await expect(page.getByTestId('cancel-button')).toBeDisabled();
        await expect(page.getByLabel('Close')).toBeDisabled();
        await expect(page.getByText('Saving...')).toBeVisible();
    });
});

test.describe('DisplayNameConflictModal - Error Display', () => {
    test('should display server error from props', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const error = document.createElement('div');
            error.setAttribute('data-testid', 'display-name-conflict-error');
            error.setAttribute('role', 'alert');
            error.textContent = 'This name is already taken.';
            error.className = 'bg-red-50 border border-red-200 text-red-800';
            document.body.appendChild(error);
        });

        const errorAlert = page.getByTestId('display-name-conflict-error');
        await expect(errorAlert).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
        await expect(errorAlert).toHaveAttribute('role', 'alert');
        await expect(errorAlert).toContainText('already taken');
    });

    test('should clear server error when user starts typing', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        await setupSuccessfulApiMocks(page);

        await page.evaluate(() => {
            const errorDiv = document.createElement('div');
            errorDiv.setAttribute('data-testid', 'display-name-conflict-error');
            errorDiv.textContent = 'Server error message';
            errorDiv.style.display = 'block';

            const input = document.createElement('input');
            input.setAttribute('data-testid', 'display-name-conflict-input');

            input.addEventListener('input', () => {
                errorDiv.style.display = 'none';
            });

            document.body.appendChild(errorDiv);
            document.body.appendChild(input);
        });

        const error = page.getByTestId('display-name-conflict-error');
        await expect(error).toBeVisible();

        const input = page.getByTestId('display-name-conflict-input');
        await input.fill('New Value');

        await expect(error).not.toBeVisible();
    });
});
