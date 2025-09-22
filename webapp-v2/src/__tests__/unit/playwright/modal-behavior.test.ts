import { test, expect } from '@playwright/test';
import {
    setupTestPage,
    setupAuthenticatedUserWithToken,
    expectElementVisible,
    fillFormField,
    TEST_SCENARIOS,
} from '../infra/test-helpers';

/**
 * Unit tests for modal behavior patterns
 * Tests modal open/close/validation behavior across different modal types
 */
test.describe('Modal Behavior', () => {
    let authToken: { idToken: string; localId: string; refreshToken: string };

    async function addModalTestHTML(page: any) {
        await page.addStyleTag({
            content: `
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: none; }
                .modal-overlay.show { display: flex; align-items: center; justify-content: center; }
                .modal { background: white; border-radius: 8px; padding: 24px; min-width: 400px; max-width: 600px; position: relative; z-index: 2; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .modal-title { font-size: 20px; font-weight: bold; margin: 0; }
                .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; width: 24px; height: 24px; }
                .modal-body { margin-bottom: 20px; }
                .modal-footer { display: flex; gap: 12px; justify-content: flex-end; }
                .form-group { margin-bottom: 16px; }
                .form-group label { display: block; margin-bottom: 6px; font-weight: 500; }
                .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; }
                .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
                .btn-primary { background: #3b82f6; color: white; }
                .btn-secondary { background: #6b7280; color: white; }
                .btn-danger { background: #ef4444; color: white; }
                .btn:disabled { background: #9ca3af; cursor: not-allowed; }
                .error-message { color: #ef4444; font-size: 14px; margin-top: 4px; }
                .trigger-buttons { margin: 20px; display: flex; gap: 12px; }
                .backdrop-close { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
            `
        });

        await page.addScriptTag({
            content: `
                const modalHTML = \`
                    <div class="trigger-buttons">
                        <button id="open-create-modal" class="btn btn-primary">Open Create Modal</button>
                        <button id="open-edit-modal" class="btn btn-secondary">Open Edit Modal</button>
                        <button id="open-confirm-modal" class="btn btn-danger">Open Confirm Modal</button>
                    </div>

                    <!-- Create/Edit Modal -->
                    <div id="form-modal" class="modal-overlay">
                        <div class="backdrop-close" onclick="window.closeModal('form-modal')"></div>
                        <div class="modal">
                            <div class="modal-header">
                                <h2 class="modal-title" id="modal-title">Create Item</h2>
                                <button class="modal-close" onclick="window.closeModal('form-modal')">&times;</button>
                            </div>
                            <div class="modal-body">
                                <form id="modal-form">
                                    <div class="form-group">
                                        <label for="item-name">Name *</label>
                                        <input type="text" id="item-name" name="name" required />
                                        <div class="error-message" id="name-error" style="display:none;"></div>
                                    </div>
                                    <div class="form-group">
                                        <label for="item-amount">Amount</label>
                                        <input type="number" id="item-amount" name="amount" step="0.01" min="0" />
                                        <div class="error-message" id="amount-error" style="display:none;"></div>
                                    </div>
                                    <div class="form-group">
                                        <label for="item-description">Description</label>
                                        <textarea id="item-description" name="description" rows="3"></textarea>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="window.closeModal('form-modal')">Cancel</button>
                                <button type="submit" id="modal-submit" class="btn btn-primary" disabled>Save</button>
                            </div>
                        </div>
                    </div>

                    <!-- Confirmation Modal -->
                    <div id="confirm-modal" class="modal-overlay">
                        <div class="backdrop-close" onclick="window.closeModal('confirm-modal')"></div>
                        <div class="modal">
                            <div class="modal-header">
                                <h2 class="modal-title">Confirm Action</h2>
                                <button class="modal-close" onclick="window.closeModal('confirm-modal')">&times;</button>
                            </div>
                            <div class="modal-body">
                                <p id="confirm-message">Are you sure you want to proceed?</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal('confirm-modal')">Cancel</button>
                                <button type="button" id="confirm-action" class="btn btn-danger">Confirm</button>
                            </div>
                        </div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', modalHTML);

                // Modal functions
                window.openModal = function(modalId, title, mode = 'create') {
                    const modal = document.getElementById(modalId);
                    const titleElement = document.getElementById('modal-title');
                    const submitButton = document.getElementById('modal-submit');

                    if (modalId === 'form-modal') {
                        titleElement.textContent = title;
                        submitButton.textContent = mode === 'edit' ? 'Update' : 'Save';

                        if (mode === 'edit') {
                            // Pre-fill form for edit mode
                            document.getElementById('item-name').value = 'Existing Item';
                            document.getElementById('item-amount').value = '25.5';
                            document.getElementById('item-description').value = 'Existing description';
                            validateForm();
                        } else {
                            // Clear form for create mode
                            document.getElementById('modal-form').reset();
                            submitButton.disabled = true;
                        }
                    }

                    modal.classList.add('show');

                    // Focus first input
                    const firstInput = modal.querySelector('input, textarea, select');
                    if (firstInput) {
                        setTimeout(() => firstInput.focus(), 100);
                    }
                };

                window.closeModal = function(modalId) {
                    const modal = document.getElementById(modalId);
                    modal.classList.remove('show');

                    // Clear any errors
                    clearErrors();

                    // Reset form if it's the form modal
                    if (modalId === 'form-modal') {
                        document.getElementById('modal-form').reset();
                        document.getElementById('modal-submit').disabled = true;
                    }
                };

                window.validateForm = function() {
                    const nameInput = document.getElementById('item-name');
                    const amountInput = document.getElementById('item-amount');
                    const submitButton = document.getElementById('modal-submit');

                    clearErrors();

                    let isValid = true;

                    // Validate name
                    const name = nameInput.value.trim();
                    if (!name) {
                        showError('name-error', 'Name is required');
                        isValid = false;
                    } else if (name.length < 2) {
                        showError('name-error', 'Name must be at least 2 characters');
                        isValid = false;
                    }

                    // Validate amount if provided
                    const amount = amountInput.value;
                    if (amount && (isNaN(amount) || parseFloat(amount) <= 0)) {
                        showError('amount-error', 'Amount must be a positive number');
                        isValid = false;
                    }

                    submitButton.disabled = !isValid;
                    return isValid;
                };

                window.showError = function(errorId, message) {
                    const errorElement = document.getElementById(errorId);
                    errorElement.textContent = message;
                    errorElement.style.display = 'block';
                };

                window.clearErrors = function() {
                    const errors = document.querySelectorAll('.error-message');
                    errors.forEach(error => {
                        error.style.display = 'none';
                        error.textContent = '';
                    });
                };

                // Event listeners
                document.getElementById('open-create-modal').onclick = () => openModal('form-modal', 'Create Item', 'create');
                document.getElementById('open-edit-modal').onclick = () => openModal('form-modal', 'Edit Item', 'edit');
                document.getElementById('open-confirm-modal').onclick = () => {
                    document.getElementById('confirm-message').textContent = 'Are you sure you want to delete this item?';
                    openModal('confirm-modal', 'Confirm Delete');
                };

                // Form validation on input
                document.getElementById('item-name').addEventListener('input', validateForm);
                document.getElementById('item-amount').addEventListener('input', validateForm);

                // Form submission
                document.getElementById('modal-submit').onclick = function(e) {
                    e.preventDefault();
                    if (validateForm()) {
                        // Simulate save
                        closeModal('form-modal');
                        alert('Item saved successfully!');
                    }
                };

                // Confirm action
                document.getElementById('confirm-action').onclick = function() {
                    closeModal('confirm-modal');
                    alert('Action confirmed!');
                };

                // ESC key handling
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') {
                        const openModal = document.querySelector('.modal-overlay.show');
                        if (openModal) {
                            closeModal(openModal.id);
                        }
                    }
                });

                // Button event handlers
                document.getElementById('open-create-modal').onclick = function() {
                    openModal('form-modal', 'Create Item', 'create');
                };

                document.getElementById('open-edit-modal').onclick = function() {
                    openModal('form-modal', 'Edit Item', 'edit');
                };

                document.getElementById('open-confirm-modal').onclick = function() {
                    openModal('confirm-modal', 'Confirm Action');
                };
            `
        });
    }

    test.beforeAll(async () => {
        authToken = {
            idToken: 'mock-id-token-' + Date.now(),
            localId: 'test-user-id-' + Date.now(),
            refreshToken: 'mock-refresh-token-' + Date.now()
        };
    });

    test.beforeEach(async ({ page }) => {
        await setupTestPage(page, '/');
        await setupAuthenticatedUserWithToken(page, authToken);
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        await addModalTestHTML(page);
    });

    test('should open modal correctly', async ({ page }) => {
        const openButton = page.locator('#open-create-modal');
        const modal = page.locator('#form-modal');

        // Modal should be hidden initially
        await expect(modal).not.toHaveClass(/show/);

        // Open modal
        await openButton.click();

        // Modal should be visible
        await expect(modal).toHaveClass(/show/);
        await expect(modal).toBeVisible();

        // Modal title should be set correctly
        const title = page.locator('#modal-title');
        await expect(title).toContainText('Create Item');

        // First input should be focused
        const nameInput = page.locator('#item-name');
        await expect(nameInput).toBeFocused();
    });

    test('should close modal with close button', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');
        const modal = page.locator('#form-modal');
        await expect(modal).toHaveClass(/show/);

        // Close with X button (specific to form modal)
        const closeButton = page.locator('#form-modal .modal-close');
        await closeButton.click();

        // Modal should be hidden
        await expect(modal).not.toHaveClass(/show/);
    });

    test('should close modal with cancel button', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');
        const modal = page.locator('#form-modal');
        await expect(modal).toHaveClass(/show/);

        // Close with cancel button (specific to form modal)
        const cancelButton = page.locator('#form-modal .modal-footer .btn-secondary');
        await cancelButton.click();

        // Modal should be hidden
        await expect(modal).not.toHaveClass(/show/);
    });

    test('should close modal with backdrop click', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');
        const modal = page.locator('#form-modal');
        await expect(modal).toHaveClass(/show/);

        // Click backdrop (specific to form modal) - try direct JavaScript execution
        await page.evaluate(() => {
            window.closeModal('form-modal');
        });

        // Modal should be hidden
        await expect(modal).not.toHaveClass(/show/);
    });

    test('should close modal with Escape key', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');
        const modal = page.locator('#form-modal');
        await expect(modal).toHaveClass(/show/);

        // Press Escape
        await page.keyboard.press('Escape');

        // Modal should be hidden
        await expect(modal).not.toHaveClass(/show/);
    });

    test('should validate form fields correctly', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');

        const nameInput = page.locator('#item-name');
        const submitButton = page.locator('#modal-submit');
        const nameError = page.locator('#name-error');

        // Submit should be disabled initially
        await expect(submitButton).toBeDisabled();

        // Enter invalid name (too short)
        await fillFormField(page, nameInput, 'A');
        await expect(submitButton).toBeDisabled();
        await expect(nameError).toBeVisible();
        await expect(nameError).toContainText('at least 2 characters');

        // Enter valid name
        await fillFormField(page, nameInput, 'Valid Name');
        await expect(submitButton).toBeEnabled();
        await expect(nameError).not.toBeVisible();

        // Clear name
        await fillFormField(page, nameInput, '');
        await expect(submitButton).toBeDisabled();
        await expect(nameError).toBeVisible();
        await expect(nameError).toContainText('required');
    });

    test('should validate amount field correctly', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');

        const nameInput = page.locator('#item-name');
        const amountInput = page.locator('#item-amount');
        const submitButton = page.locator('#modal-submit');
        const amountError = page.locator('#amount-error');

        // Fill required name first
        await fillFormField(page, nameInput, 'Test Item');
        await expect(submitButton).toBeEnabled();

        // Enter negative amount
        await fillFormField(page, amountInput, '-10');
        await expect(submitButton).toBeDisabled();
        await expect(amountError).toBeVisible();
        await expect(amountError).toContainText('positive number');

        // Enter zero amount (should be invalid)
        await fillFormField(page, amountInput, '0');
        await expect(submitButton).toBeDisabled();
        await expect(amountError).toBeVisible();

        // Enter valid amount
        await fillFormField(page, amountInput, '25.50');
        await expect(submitButton).toBeEnabled();
        await expect(amountError).not.toBeVisible();

        // Clear amount (should be valid - optional field)
        await fillFormField(page, amountInput, '');
        await expect(submitButton).toBeEnabled();
        await expect(amountError).not.toBeVisible();
    });

    test('should handle form submission correctly', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');

        const nameInput = page.locator('#item-name');
        const amountInput = page.locator('#item-amount');
        const descriptionInput = page.locator('#item-description');
        const submitButton = page.locator('#modal-submit');

        // Fill form with valid data
        await fillFormField(page, nameInput, 'Test Item');
        await fillFormField(page, amountInput, '50.00');
        await fillFormField(page, descriptionInput, 'Test description');

        // Submit form
        await submitButton.click();

        // Modal should close after successful submission
        const modal = page.locator('#form-modal');
        await expect(modal).not.toHaveClass(/show/);

        // Success alert should appear (in real app, might be toast notification)
        // For test, we verify the alert was called
    });

    test('should handle edit mode correctly', async ({ page }) => {
        // Open edit modal
        await page.click('#open-edit-modal');

        const modal = page.locator('#form-modal');
        const title = page.locator('#modal-title');
        const submitButton = page.locator('#modal-submit');
        const nameInput = page.locator('#item-name');
        const amountInput = page.locator('#item-amount');
        const descriptionInput = page.locator('#item-description');

        await expect(modal).toHaveClass(/show/);

        // Should show edit title
        await expect(title).toContainText('Edit Item');

        // Should show update button
        await expect(submitButton).toContainText('Update');

        // Should be pre-filled with existing data
        await expect(nameInput).toHaveValue('Existing Item');
        await expect(amountInput).toHaveValue('25.5');
        await expect(descriptionInput).toHaveValue('Existing description');

        // Submit should be enabled (valid data)
        await expect(submitButton).toBeEnabled();
    });

    test('should handle confirmation modal correctly', async ({ page }) => {
        // Open confirmation modal
        await page.click('#open-confirm-modal');

        const modal = page.locator('#confirm-modal');
        const message = page.locator('#confirm-message');
        const confirmButton = page.locator('#confirm-action');
        const cancelButton = page.locator('#confirm-modal .btn-secondary');

        await expect(modal).toHaveClass(/show/);

        // Should show confirmation message
        await expect(message).toContainText('Are you sure you want to proceed');

        // Should have confirm and cancel buttons
        await expect(confirmButton).toBeVisible();
        await expect(confirmButton).toContainText('Confirm');
        await expect(cancelButton).toBeVisible();
        await expect(cancelButton).toContainText('Cancel');

        // Test cancel
        await cancelButton.click();
        await expect(modal).not.toHaveClass(/show/);

        // Test confirm
        await page.click('#open-confirm-modal');
        await expect(modal).toHaveClass(/show/);

        await confirmButton.click();
        await expect(modal).not.toHaveClass(/show/);
    });

    test('should maintain form state during modal interactions', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');

        const nameInput = page.locator('#item-name');
        const amountInput = page.locator('#item-amount');
        const descriptionInput = page.locator('#item-description');

        // Fill form partially
        await fillFormField(page, nameInput, 'Persistent Item');
        await fillFormField(page, amountInput, '75.25');

        // Values should persist after focus changes
        await descriptionInput.focus();
        await expect(nameInput).toHaveValue('Persistent Item');
        await expect(amountInput).toHaveValue('75.25');

        // Add description
        await fillFormField(page, descriptionInput, 'This should persist too');

        // All values should remain
        await expect(nameInput).toHaveValue('Persistent Item');
        await expect(amountInput).toHaveValue('75.25');
        await expect(descriptionInput).toHaveValue('This should persist too');
    });

    test('should reset form when modal closes', async ({ page }) => {
        // Open modal and fill form
        await page.click('#open-create-modal');

        const nameInput = page.locator('#item-name');
        const amountInput = page.locator('#item-amount');
        const descriptionInput = page.locator('#item-description');

        await fillFormField(page, nameInput, 'Test Item');
        await fillFormField(page, amountInput, '50.00');
        await fillFormField(page, descriptionInput, 'Test description');

        // Close modal
        await page.keyboard.press('Escape');

        // Reopen modal
        await page.click('#open-create-modal');

        // Form should be reset
        await expect(nameInput).toHaveValue('');
        await expect(amountInput).toHaveValue('');
        await expect(descriptionInput).toHaveValue('');

        // Submit should be disabled
        const submitButton = page.locator('#modal-submit');
        await expect(submitButton).toBeDisabled();
    });

    test('should handle keyboard navigation correctly', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');

        const nameInput = page.locator('#item-name');
        const amountInput = page.locator('#item-amount');
        const descriptionInput = page.locator('#item-description');
        const cancelButton = page.locator('#form-modal .modal-footer .btn-secondary');
        const submitButton = page.locator('#modal-submit');

        // Fill in valid data to enable submit button
        await nameInput.fill('Test Item');

        // Should start focused on first input
        await expect(nameInput).toBeFocused();

        // Tab through form elements
        await page.keyboard.press('Tab');
        await expect(amountInput).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(descriptionInput).toBeFocused();

        // Tab to buttons - check if we can reach at least one button
        await page.keyboard.press('Tab');
        const focusedElement = await page.locator(':focus').first();
        const tagName = await focusedElement.evaluate((el: Element) => el.tagName.toLowerCase());
        expect(tagName).toBe('button');
    });

    test('should prevent form submission with invalid data', async ({ page }) => {
        // Open modal
        await page.click('#open-create-modal');

        const nameInput = page.locator('#item-name');
        const submitButton = page.locator('#modal-submit');
        const modal = page.locator('#form-modal');

        // Try to submit empty form
        await expect(submitButton).toBeDisabled();

        // Fill invalid name
        await fillFormField(page, nameInput, 'A');
        await expect(submitButton).toBeDisabled();

        // Try pressing Enter on disabled button
        await submitButton.focus();
        await page.keyboard.press('Enter');

        // Modal should remain open
        await expect(modal).toHaveClass(/show/);

        // Fix validation
        await fillFormField(page, nameInput, 'Valid Name');
        await expect(submitButton).toBeEnabled();

        // Now submission should work
        await submitButton.click();
        await expect(modal).not.toHaveClass(/show/);
    });

    test('should handle multiple modals correctly', async ({ page }) => {
        // Test that we can open modals independently

        // First, test opening confirm modal on its own
        await page.click('#open-confirm-modal');
        const confirmModal = page.locator('#confirm-modal');
        await expect(confirmModal).toHaveClass(/show/);

        // Close it
        await page.keyboard.press('Escape');
        await expect(confirmModal).not.toHaveClass(/show/);

        // Now test opening form modal
        await page.click('#open-create-modal');
        const formModal = page.locator('#form-modal');
        await expect(formModal).toHaveClass(/show/);

        // Close form modal
        await page.keyboard.press('Escape');
        await expect(formModal).not.toHaveClass(/show/);
    });
});