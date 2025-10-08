import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';
import { loadTranslation } from './translation-loader';

const translation = loadTranslation();

/**
 * Edit Group Modal Page Object Model for Playwright tests
 * Handles both edit form and delete confirmation dialog
 * Reusable across unit tests and e2e tests
 */
export class EditGroupModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER SELECTORS
    // ============================================================================

    /**
     * Main modal container
     */
    getModalContainer(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByTestId('edit-group-modal-title'),
        });
    }

    /**
     * Delete confirmation dialog container
     */
    getDeleteDialog(): Locator {
        return this.page.getByTestId('delete-group-dialog');
    }

    /**
     * Modal backdrop
     */
    getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]'),
        });
    }

    // ============================================================================
    // FORM FIELD SELECTORS
    // ============================================================================

    /**
     * Group name input field
     */
    getGroupNameInput(): Locator {
        return this.getModalContainer().getByTestId('group-name-input');
    }

    /**
     * Group description textarea field
     */
    getGroupDescriptionInput(): Locator {
        return this.getModalContainer().getByTestId('group-description-input');
    }

    // ============================================================================
    // BUTTON SELECTORS
    // ============================================================================

    /**
     * Save changes button
     */
    getSaveButton(): Locator {
        return this.getModalContainer().getByTestId('save-changes-button');
    }

    /**
     * Cancel button
     */
    getCancelButton(): Locator {
        return this.getModalContainer().getByTestId('cancel-edit-group-button');
    }

    /**
     * Delete group button (opens delete confirmation)
     */
    getDeleteButton(): Locator {
        return this.getModalContainer().getByTestId('delete-group-button');
    }

    /**
     * Close button (X icon)
     */
    getCloseButton(): Locator {
        return this
            .getModalContainer()
            .locator('button')
            .filter({
                has: this.page.locator('svg'),
            })
            .first();
    }

    // ============================================================================
    // DELETE DIALOG SELECTORS
    // ============================================================================

    /**
     * Confirmation text input in delete dialog
     */
    getDeleteConfirmationInput(): Locator {
        return this.getDeleteDialog().locator('input[type="text"]');
    }

    /**
     * Confirm delete button in dialog
     */
    getConfirmDeleteButton(): Locator {
        return this
            .getDeleteDialog()
            .getByRole('button', { name: /delete/i })
            .last();
    }

    /**
     * Cancel delete button in dialog
     */
    getCancelDeleteButton(): Locator {
        return this.getDeleteDialog().getByRole('button', { name: /cancel/i });
    }

    // ============================================================================
    // ERROR MESSAGE SELECTORS
    // ============================================================================

    /**
     * Validation error message
     */
    getValidationError(): Locator {
        return this.getModalContainer().getByTestId('edit-group-validation-error');
    }

    /**
     * Delete error message in confirmation dialog
     */
    getDeleteError(): Locator {
        return this.getDeleteDialog().locator('[role="alert"]');
    }

    // ============================================================================
    // ACTION METHODS - Modal
    // ============================================================================

    /**
     * Wait for edit modal to open
     */
    async waitForModalToOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout });
        await expect(this.getGroupNameInput()).toBeVisible();
        await expect(this.getSaveButton()).toBeVisible();
    }

    /**
     * Wait for edit modal to close
     */
    async waitForModalToClose(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible({ timeout });
    }

    /**
     * Fill group name field
     */
    async fillGroupName(name: string): Promise<void> {
        await this.fillPreactInput(this.getGroupNameInput(), name);
    }

    /**
     * Fill group description field
     */
    async fillGroupDescription(description: string): Promise<void> {
        const input = this.getGroupDescriptionInput();
        await input.click();
        await input.fill(description);
        await input.dispatchEvent('input');
        await input.blur();
    }

    /**
     * Fill both group name and description
     */
    async fillGroupForm(name: string, description?: string): Promise<void> {
        await this.fillGroupName(name);
        if (description !== undefined) {
            await this.fillGroupDescription(description);
        }
    }

    /**
     * Submit the edit form
     */
    async submitForm(): Promise<void> {
        const saveButton = this.getSaveButton();
        await this.clickButton(saveButton, { buttonName: 'Save Changes' });
    }

    /**
     * Click cancel button
     */
    async clickCancel(): Promise<void> {
        const button = this.getCancelButton();
        await this.clickButton(button, { buttonName: 'Cancel' });
    }

    /**
     * Click close button (X)
     */
    async clickClose(): Promise<void> {
        const button = this.getCloseButton();
        await button.click();
    }

    /**
     * Close modal by clicking backdrop
     */
    async clickOutsideToClose(): Promise<void> {
        const backdrop = this.getModalBackdrop();
        await backdrop.click({ position: { x: 10, y: 10 } });
    }

    /**
     * Close modal by pressing Escape
     */
    async pressEscapeToClose(): Promise<void> {
        await super.pressEscapeToClose(this.getModalContainer());
    }

    // ============================================================================
    // ACTION METHODS - Delete Flow
    // ============================================================================

    /**
     * Click delete button to open confirmation dialog
     */
    async clickDelete(): Promise<void> {
        const button = this.getDeleteButton();
        await this.clickButton(button, { buttonName: 'Delete Group' });
        await expect(this.getDeleteDialog()).toBeVisible({ timeout: 2000 });
    }

    /**
     * Fill delete confirmation input with group name
     */
    async fillDeleteConfirmation(groupName: string): Promise<void> {
        const input = this.getDeleteConfirmationInput();
        await input.click();
        await input.fill(groupName);
        await input.dispatchEvent('input');
    }

    /**
     * Click confirm delete button in dialog
     */
    async confirmDelete(): Promise<void> {
        const button = this.getConfirmDeleteButton();
        await this.clickButton(button, { buttonName: 'Confirm Delete' });
    }

    /**
     * Click cancel in delete dialog
     */
    async cancelDelete(): Promise<void> {
        const button = this.getCancelDeleteButton();
        await this.clickButton(button, { buttonName: 'Cancel Delete' });
    }

    /**
     * Complete delete workflow: click delete → fill confirmation → confirm
     */
    async deleteGroup(groupName: string): Promise<void> {
        await this.clickDelete();
        await this.fillDeleteConfirmation(groupName);
        await this.confirmDelete();
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify modal is open with correct structure
     */
    async verifyModalOpen(): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible();
        await expect(this.getGroupNameInput()).toBeVisible();
        await expect(this.getGroupDescriptionInput()).toBeVisible();
        await expect(this.getSaveButton()).toBeVisible();
        await expect(this.getCancelButton()).toBeVisible();
        await expect(this.getDeleteButton()).toBeVisible();
    }

    /**
     * Verify modal is closed
     */
    async verifyModalClosed(): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible();
    }

    /**
     * Verify form has specific values
     */
    async verifyFormValues(expectedName: string, expectedDescription?: string): Promise<void> {
        await expect(this.getGroupNameInput()).toHaveValue(expectedName);
        if (expectedDescription !== undefined) {
            await expect(this.getGroupDescriptionInput()).toHaveValue(expectedDescription);
        }
    }

    /**
     * Verify save button state
     */
    async verifySaveButtonState(shouldBeEnabled: boolean): Promise<void> {
        if (shouldBeEnabled) {
            await expect(this.getSaveButton()).toBeEnabled();
        } else {
            await expect(this.getSaveButton()).toBeDisabled();
        }
    }

    /**
     * Verify specific validation error
     */
    async verifyValidationError(expectedMessage: string): Promise<void> {
        await expect(this.getValidationError()).toBeVisible();
        await expect(this.getValidationError()).toContainText(expectedMessage);
    }

    /**
     * Verify no validation error
     */
    async verifyNoValidationError(): Promise<void> {
        await expect(this.getValidationError()).not.toBeVisible();
    }

    /**
     * Verify delete confirmation dialog is open
     */
    async verifyDeleteDialogOpen(): Promise<void> {
        await expect(this.getDeleteDialog()).toBeVisible();
        await expect(this.getDeleteConfirmationInput()).toBeVisible();
        await expect(this.getConfirmDeleteButton()).toBeVisible();
        await expect(this.getCancelDeleteButton()).toBeVisible();
    }

    /**
     * Verify delete confirmation dialog is closed
     */
    async verifyDeleteDialogClosed(): Promise<void> {
        await expect(this.getDeleteDialog()).not.toBeVisible();
    }

    /**
     * Verify confirm delete button state based on input match
     */
    async verifyConfirmDeleteButtonState(shouldBeEnabled: boolean): Promise<void> {
        if (shouldBeEnabled) {
            await expect(this.getConfirmDeleteButton()).toBeEnabled();
        } else {
            await expect(this.getConfirmDeleteButton()).toBeDisabled();
        }
    }
}
