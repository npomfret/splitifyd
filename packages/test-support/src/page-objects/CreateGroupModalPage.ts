import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

/**
 * Create Group Modal Page Object Model for Playwright tests
 * Container-aware selectors using visible headings and semantic elements
 * Reusable across unit tests and e2e tests
 *
 * ## Modal Interaction Pattern
 *
 * Modals don't navigate to other pages, so they don't follow the fluent
 * navigation pattern. They only open/close and interact with form elements.
 *
 * - Modal methods perform actions and may return values (e.g., form data)
 * - They do NOT return page objects (except when closing might navigate)
 * - Use the parent page's fluent method to open modals (e.g., `clickCreateGroupAndOpenModal()`)
 * - Once you have the modal page object, interact with it directly
 *
 * @example
 * // Open modal using parent page's fluent method
 * const createModal = await dashboardPage.clickCreateGroup();
 *
 * // Interact with modal directly
 * await createModal.fillGroupForm('My Group', 'Description');
 * await createModal.submitForm();
 * await createModal.waitForModalToClose();
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
            has: this.page.getByRole('heading', { name: translation.createGroupModal.title }),
        });
    }

    /**
     * Modal backdrop (for click-outside-to-close detection)
     */
    getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]'),
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
        return this
            .getModalContainer()
            .locator('button')
            .filter({
                has: this.page.locator('svg'),
            })
            .first();
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
            hasText: /.+/, // Must have some text
        });
    }

    /**
     * Error locator helper that mirrors the legacy e2e implementation by
     * scanning common alert patterns inside the modal. Useful when network
     * failures render messages outside the standard container.
     */
    getErrorMessage(pattern?: string | RegExp): Locator {
        const allErrors = this.page.locator(
            [
                '[data-testid="create-group-error-message"]',
                '[role="alert"]',
                '[data-testid*="error"]',
                '.error-message',
                '[role="dialog"] [role="alert"]',
            ]
                .join(', '),
        );

        return pattern ? allErrors.filter({ hasText: pattern }) : allErrors;
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Wait for modal to be visible and ready for interaction
     */
    async waitForModalToOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout });
        await expect(this.getModalTitle()).toBeVisible({ timeout });
        await expect(this.getGroupNameInput()).toBeVisible({ timeout });
        await expect(this.getSubmitButton()).toBeVisible({ timeout });
    }

    /**
     * Wait for modal to close and disappear
     */
    async waitForModalToClose(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible({ timeout });
    }

    /**
     * Fill the group name field using proper Preact handling
     */
    async fillGroupName(name: string): Promise<void> {
        // Defensive check: Verify modal is STILL open before trying to fill input
        // This catches race conditions where modal closes during test execution
        const modalContainer = this.getModalContainer();
        const isModalVisible = await modalContainer.isVisible().catch(() => false);

        if (!isModalVisible) {
            throw new Error(
                `Cannot fill group name - Create Group Modal is not open or has already closed.\n`
                    + `This usually means:\n`
                    + `  1. Modal closed unexpectedly (check browser console for "[CreateGroupModal] Closing modal" logs)\n`
                    + `  2. Modal was never opened in the first place\n`
                    + `  3. Navigation occurred while modal was still processing\n`
                    + `Current URL: ${this.page.url()}\n`
                    + `Attempted to fill name: "${name}"`,
            );
        }

        // Verify input is visible and enabled
        const input = this.getGroupNameInput();
        try {
            await expect(input).toBeVisible({ timeout: 2000 });
            await expect(input).toBeEnabled({ timeout: 1000 });
        } catch (error) {
            // Double-check modal is still there
            const stillVisible = await modalContainer.isVisible().catch(() => false);
            if (!stillVisible) {
                throw new Error(
                    `Create Group Modal closed while waiting for input to be ready.\n`
                        + `The modal was visible initially but closed during interaction.\n`
                        + `Check browser console for "[CreateGroupModal] Closing modal" logs to see why it closed.\n`
                        + `Original error: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
            throw error;
        }

        await this.fillPreactInput(input, name);
    }

    /**
     * Fill the group description field using proper Preact handling
     */
    async fillGroupDescription(description: string): Promise<void> {
        // Defensive check: Verify modal is still open
        const modalContainer = this.getModalContainer();
        const isModalVisible = await modalContainer.isVisible().catch(() => false);

        if (!isModalVisible) {
            throw new Error(
                `Cannot fill group description - Create Group Modal is not open or has closed.\n`
                    + `Current URL: ${this.page.url()}\n`
                    + `Check browser console for "[CreateGroupModal] Closing modal" logs.`,
            );
        }

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
        // Defensive check: Verify modal is still open before submitting
        const modalContainer = this.getModalContainer();
        const isModalVisible = await modalContainer.isVisible().catch(() => false);

        if (!isModalVisible) {
            throw new Error(
                `Cannot submit form - Create Group Modal is not open or has closed.\n`
                    + `Current URL: ${this.page.url()}\n`
                    + `Check browser console for "[CreateGroupModal] Closing modal" logs.`,
            );
        }

        const submitButton = this.getSubmitButton();
        await this.clickButton(submitButton, { buttonName: 'Create Group' });
    }

    /**
     * Complete create group process with form data
     * Does NOT wait for modal to close - caller should handle that
     */
    async createGroup(name: string, description?: string): Promise<void> {
        // Defensive check: Verify modal is open at the start of the operation
        // This will fail early with clear error if modal is not visible
        // Error will include the group name being created for debugging context
        try {
            await expect(this.getModalContainer()).toBeVisible({ timeout: 2000 });
        } catch (error) {
            throw new Error(`Create Group Modal must be open before calling createGroup("${name}"). Modal not found or already closed.`);
        }
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

    /**
     * Click the create button (alias for submitForm for semantic consistency)
     */
    async clickCreateButton(): Promise<void> {
        await this.submitForm();
    }

    /**
     * Verify error message is visible (without checking specific text)
     */
    async verifyErrorMessageVisible(): Promise<void> {
        await expect(this.getErrorContainer()).toBeVisible();
    }
}
