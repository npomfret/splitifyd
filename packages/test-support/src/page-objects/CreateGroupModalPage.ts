import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { loadTranslation } from './translation-loader';

const translation = loadTranslation();

/**
 * Create Group Modal Page Object Model for Playwright tests
 * Container-aware selectors using visible headings and semantic elements
 * Reusable across unit tests and e2e tests
 */
export class CreateGroupModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER SELECTORS - Based on visible UI elements users can see
    // ============================================================================

    /**
     * Modal dialog container - identified by dialog role and title
     */
    getModalContainer(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByRole('heading', { name: translation.createGroupModal.title })
        });
    }

    /**
     * Modal backdrop (for click-outside-to-close detection)
     */
    getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]')
        });
    }

    // ============================================================================
    // HEADING SELECTORS
    // ============================================================================

    /**
     * Modal title heading
     */
    getModalTitle(): Locator {
        return this.getModalContainer().getByRole('heading', { name: translation.createGroupModal.title });
    }

    // ============================================================================
    // FORM FIELD SELECTORS - Scoped to modal container
    // ============================================================================

    /**
     * Group name input field
     */
    getGroupNameInput(): Locator {
        return this.getModalContainer().locator('input[name="name"]');
    }

    /**
     * Group description textarea field
     */
    getGroupDescriptionInput(): Locator {
        return this.getModalContainer().getByTestId('group-description-input');
    }

    /**
     * Group name help text
     */
    getGroupNameHelpText(): Locator {
        return this.getModalContainer().getByText(translation.createGroupModal.groupNameHelpText);
    }

    /**
     * Group description help text
     */
    getGroupDescriptionHelpText(): Locator {
        return this.getModalContainer().getByText(translation.createGroupModal.groupDescriptionHelpText);
    }

    // ============================================================================
    // BUTTON SELECTORS - Scoped to modal container
    // ============================================================================

    /**
     * Submit button (Create Group)
     */
    getSubmitButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.createGroupModal.submitButton });
    }

    /**
     * Cancel button
     */
    getCancelButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.createGroupModal.cancelButton });
    }

    /**
     * Close button (X icon in header)
     */
    getCloseButton(): Locator {
        // The close button is in the header and has an SVG icon
        return this.getModalContainer().locator('button').filter({
            has: this.page.locator('svg')
        }).first();
    }

    // ============================================================================
    // ERROR MESSAGE SELECTORS
    // ============================================================================

    /**
     * Error message container within the modal (for API/server errors)
     */
    getErrorContainer(): Locator {
        return this.getModalContainer().getByTestId('create-group-error-message');
    }

    /**
     * Validation error message for group name field
     */
    getValidationError(): Locator {
        // Input component shows error with role="alert" adjacent to input
        return this.getModalContainer().locator('[role="alert"]').filter({
            hasText: /.+/ // Must have some text
        });
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Wait for modal to be visible and ready for interaction
     */
    async waitForModalToOpen(timeout = 2000): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout });
        await expect(this.getModalTitle()).toBeVisible();
        await expect(this.getGroupNameInput()).toBeVisible();
        await expect(this.getSubmitButton()).toBeVisible();
    }

    /**
     * Wait for modal to close and disappear
     */
    async waitForModalToClose(timeout = 2000): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible({ timeout });
    }

    /**
     * Fill the group name field using proper Preact handling
     */
    async fillGroupName(name: string): Promise<void> {
        await this.fillPreactInput(this.getGroupNameInput(), name);
    }

    /**
     * Fill the group description field using proper Preact handling
     */
    async fillGroupDescription(description: string): Promise<void> {
        const input = this.getGroupDescriptionInput();
        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();
        await input.click();
        await input.fill(description);
        await input.dispatchEvent('input');
        await input.blur();
    }

    /**
     * Fill both group name and description fields
     */
    async fillGroupForm(name: string, description?: string): Promise<void> {
        await this.fillGroupName(name);
        if (description) {
            await this.fillGroupDescription(description);
        }
    }

    /**
     * Submit the modal form
     */
    async submitForm(): Promise<void> {
        const submitButton = this.getSubmitButton();
        await this.clickButton(submitButton, { buttonName: 'Create Group' });
    }

    /**
     * Complete create group process with form data
     * Does NOT wait for modal to close - caller should handle that
     */
    async createGroup(name: string, description?: string): Promise<void> {
        await this.fillGroupForm(name, description);
        await this.submitForm();
    }

    /**
     * Click the cancel button
     */
    async clickCancel(): Promise<void> {
        const button = this.getCancelButton();
        await this.clickButton(button, { buttonName: 'Cancel' });
    }

    /**
     * Click the close button (X icon)
     */
    async clickClose(): Promise<void> {
        const button = this.getCloseButton();
        await button.click();
    }

    /**
     * Close modal by clicking outside (on backdrop)
     */
    async clickOutsideToClose(): Promise<void> {
        const backdrop = this.getModalBackdrop();
        // Click on the backdrop at specific coordinates to avoid clicking modal content
        await backdrop.click({ position: { x: 10, y: 10 } });
    }

    /**
     * Close modal by pressing Escape key
     */
    async pressEscapeToClose(): Promise<void> {
        await super.pressEscapeToClose(this.getModalContainer());
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify modal is open with correct initial state
     */
    async verifyModalOpen(): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible();
        await expect(this.getModalTitle()).toBeVisible();
        await expect(this.getGroupNameInput()).toBeVisible();
        await expect(this.getGroupDescriptionInput()).toBeVisible();
        await expect(this.getSubmitButton()).toBeVisible();
        await expect(this.getCancelButton()).toBeVisible();
        await expect(this.getCloseButton()).toBeVisible();
    }

    /**
     * Verify modal is closed
     */
    async verifyModalClosed(): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible();
    }

    /**
     * Verify form is in initial empty state
     */
    async verifyFormEmpty(): Promise<void> {
        await expect(this.getGroupNameInput()).toHaveValue('');
        await expect(this.getGroupDescriptionInput()).toHaveValue('');
        await expect(this.getSubmitButton()).toBeDisabled();
    }

    /**
     * Verify form fields are enabled (not in loading state)
     */
    async verifyFormEnabled(): Promise<void> {
        await expect(this.getGroupNameInput()).toBeEnabled();
        await expect(this.getGroupDescriptionInput()).toBeEnabled();
        await expect(this.getSubmitButton()).toBeEnabled();
        await expect(this.getCancelButton()).toBeEnabled();
    }

    /**
     * Verify form fields are disabled (in loading state)
     */
    async verifyFormDisabled(): Promise<void> {
        await expect(this.getGroupNameInput()).toBeDisabled();
        await expect(this.getGroupDescriptionInput()).toBeDisabled();
        await expect(this.getSubmitButton()).toBeDisabled();
        await expect(this.getCancelButton()).toBeDisabled();
    }

    /**
     * Verify specific error message is displayed
     */
    async verifyErrorMessage(expectedMessage: string): Promise<void> {
        await expect(this.getErrorContainer()).toBeVisible();
        await expect(this.getErrorContainer()).toContainText(expectedMessage);
    }

    /**
     * Verify specific validation error is displayed
     */
    async verifyValidationError(expectedMessage: string): Promise<void> {
        await expect(this.getValidationError()).toBeVisible();
        await expect(this.getValidationError()).toContainText(expectedMessage);
    }

    /**
     * Verify no error message is displayed
     */
    async verifyNoErrorMessage(): Promise<void> {
        await expect(this.getErrorContainer()).not.toBeVisible();
    }

    /**
     * Verify no validation error is displayed
     */
    async verifyNoValidationError(): Promise<void> {
        await expect(this.getValidationError()).not.toBeVisible();
    }

    /**
     * Verify submit button state based on form validity
     */
    async verifySubmitButtonState(shouldBeEnabled: boolean): Promise<void> {
        if (shouldBeEnabled) {
            await expect(this.getSubmitButton()).toBeEnabled();
        } else {
            await expect(this.getSubmitButton()).toBeDisabled();
        }
    }

    /**
     * Verify help text is displayed correctly
     */
    async verifyHelpTextDisplayed(): Promise<void> {
        await expect(this.getGroupNameHelpText()).toBeVisible();
        await expect(this.getGroupDescriptionHelpText()).toBeVisible();
    }
}
