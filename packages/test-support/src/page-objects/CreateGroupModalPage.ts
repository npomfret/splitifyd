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
     * Modal dialog container - identified by dialog role and accessible name
     */
    protected getModalContainer(): Locator {
        return this.page.getByRole('dialog', { name: translation.createGroupModal.title });
    }

    /**
     * Modal backdrop (for click-outside-to-close detection)
     */
    protected getModalBackdrop(): Locator {
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
    protected getModalTitle(): Locator {
        return this.getModalContainer().getByRole('heading', { name: translation.createGroupModal.title });
    }

    // ============================================================================
    // FORM FIELD SELECTORS - Scoped to modal container
    // ============================================================================

    /**
     * Group name input field - uses label for semantic selection
     */
    private getGroupNameInputInternal(): Locator {
        return this.getModalContainer().getByLabel(translation.createGroupModal.groupNameLabel);
    }

    private getGroupDisplayNameInputInternal(): Locator {
        return this.getModalContainer().getByLabel(translation.createGroupModal.groupDisplayNameLabel);
    }

    /**
     * Group description textarea field
     */
    private getGroupDescriptionInputInternal(): Locator {
        return this.getModalContainer().getByLabel(translation.createGroupModal.groupDescriptionLabel);
    }

    /**
     * Group name info icon (help text is in tooltip).
     * Scoped: find label containing group name text, then info icon within.
     */
    protected getGroupNameInfoIcon(): Locator {
        return this.getModalContainer()
            .locator('label')
            .filter({ hasText: translation.createGroupModal.groupNameLabel })
            .getByLabel(translation.common.moreInfo);
    }

    /**
     * Group description info icon (help text is in tooltip).
     * Scoped: find label containing description text, then info icon within.
     */
    protected getGroupDescriptionInfoIcon(): Locator {
        return this.getModalContainer()
            .locator('label')
            .filter({ hasText: translation.createGroupModal.groupDescriptionLabel })
            .getByLabel(translation.common.moreInfo);
    }

    /**
     * Group display name info icon (help text is in tooltip).
     * Scoped: find label containing display name text, then info icon within.
     */
    protected getGroupDisplayNameInfoIcon(): Locator {
        return this.getModalContainer()
            .locator('label')
            .filter({ hasText: translation.createGroupModal.groupDisplayNameLabel })
            .getByLabel(translation.common.moreInfo);
    }

    // ============================================================================
    // BUTTON SELECTORS - Scoped to modal container
    // ============================================================================

    /**
     * Submit button (Create Group)
     */
    protected getSubmitButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.createGroupModal.submitButton });
    }

    /**
     * Cancel button
     */
    protected getCancelButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.createGroupModal.cancelButton });
    }

    /**
     * Close button (X icon in header).
     * Uses aria-label for semantic selection.
     */
    protected getCloseButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.createGroupModal.closeButtonAriaLabel });
    }

    // ============================================================================
    // ERROR MESSAGE SELECTORS
    // ============================================================================

    /**
     * Error message container within the modal (for API/server errors)
     * The error message has role="alert" for accessibility
     */
    protected getErrorContainer(): Locator {
        return this.getModalContainer().getByRole('alert');
    }

    /**
     * Validation error message for group name field
     */
    protected getValidationError(): Locator {
        // Input component shows error with role="alert" adjacent to input
        return this.getModalContainer().locator('[role="alert"]').filter({
            hasText: /.+/, // Must have some text
        });
    }

    /**
     * Error locator helper that scans common alert patterns inside the modal.
     * Uses semantic selectors where possible.
     */
    protected getErrorMessage(pattern?: string | RegExp): Locator {
        // Focus on role="alert" which is the primary semantic indicator
        const allErrors = this.getModalContainer().getByRole('alert');

        return pattern ? allErrors.filter({ hasText: pattern }) : allErrors;
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Wait for modal to be visible and ready for interaction
     * Waits for inputs to be editable, not just visible, ensuring the modal is
     * stable and ready for user interaction
     */
    async waitForModalToOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout });
        await expect(this.getModalTitle()).toBeVisible({ timeout });

        // Wait for inputs to be editable (not just visible)
        // This ensures the modal is fully ready and stable
        await expect(this.getGroupNameInputInternal()).toBeEditable({ timeout });
        await expect(this.getGroupDisplayNameInputInternal()).toBeEditable({ timeout });
        await expect(this.getGroupDescriptionInputInternal()).toBeEditable({ timeout });

        // Submit button should be visible and attached to DOM
        await expect(this.getSubmitButton()).toBeAttached({ timeout });
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
        const input = this.getGroupNameInputInternal();
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

        const input = this.getGroupDescriptionInputInternal();
        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();
        await input.click();
        await input.fill(description);
        await input.dispatchEvent('input');
        await input.blur();
    }

    async fillGroupDisplayName(displayName: string): Promise<void> {
        const input = this.getGroupDisplayNameInputInternal();
        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();
        await input.click();
        await input.fill(displayName);
        await input.dispatchEvent('input');
        await input.blur();
    }

    /**
     * Fill both group name and description fields
     */
    async fillGroupForm(name: string, description?: string, displayName?: string): Promise<void> {
        await this.fillGroupName(name);
        if (displayName) {
            await this.fillGroupDisplayName(displayName);
        }
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
    async createGroup(name: string, description?: string, displayName?: string): Promise<void> {
        // Defensive check: Verify modal is open at the start of the operation
        // This will fail early with clear error if modal is not visible
        // Error will include the group name being created for debugging context
        try {
            await expect(this.getModalContainer()).toBeVisible({ timeout: 2000 });
        } catch (error) {
            throw new Error(`Create Group Modal must be open before calling createGroup("${name}"). Modal not found or already closed.`);
        }
        await this.fillGroupForm(name, description, displayName);
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
     * Check if modal is currently visible (non-throwing)
     */
    async isModalVisible(): Promise<boolean> {
        return await this.getModalContainer().isVisible().catch(() => false);
    }

    /**
     * Verify modal is visible
     */
    async verifyModalVisible(options?: { timeout?: number; }): Promise<void> {
        const { timeout } = options || {};
        await expect(this.getModalContainer()).toBeVisible(timeout ? { timeout } : {});
    }

    /**
     * Verify modal is not visible
     */
    async verifyModalNotVisible(options?: { timeout?: number; }): Promise<void> {
        const { timeout } = options || {};
        await expect(this.getModalContainer()).not.toBeVisible(timeout ? { timeout } : {});
    }

    /**
     * Verify modal is open with correct initial state
     */
    async verifyModalOpen(): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible();
        await expect(this.getModalTitle()).toBeVisible();
        await expect(this.getGroupNameInputInternal()).toBeVisible();
        await expect(this.getGroupDisplayNameInputInternal()).toBeVisible();
        await expect(this.getGroupDescriptionInputInternal()).toBeVisible();
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
        await expect(this.getGroupNameInputInternal()).toHaveValue('');
        await expect(this.getGroupDisplayNameInputInternal()).toBeVisible();
        await expect(this.getGroupDescriptionInputInternal()).toHaveValue('');
        await expect(this.getSubmitButton()).toBeDisabled();
    }

    /**
     * Verify group name input has specific value
     */
    async verifyGroupNameValue(expectedValue: string): Promise<void> {
        await expect(this.getGroupNameInputInternal()).toHaveValue(expectedValue);
    }

    /**
     * Verify group display name input has specific value
     */
    async verifyGroupDisplayNameValue(expectedValue: string): Promise<void> {
        await expect(this.getGroupDisplayNameInputInternal()).toHaveValue(expectedValue);
    }

    /**
     * Verify group description input has specific value
     */
    async verifyGroupDescriptionValue(expectedValue: string): Promise<void> {
        await expect(this.getGroupDescriptionInputInternal()).toHaveValue(expectedValue);
    }

    /**
     * Verify specific error message is displayed
     */
    async verifyErrorMessage(expectedMessage: string): Promise<void> {
        await expect(this.getErrorContainer()).toBeVisible();
        await expect(this.getErrorContainer()).toContainText(expectedMessage);
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

    async verifySubmitButtonEnabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeEnabled();
    }

    async verifySubmitButtonDisabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeDisabled();
    }

    async verifyErrorMessageVisible(): Promise<void> {
        // .first(): Multiple alerts may exist; asserting at least one is visible
        await expect(this.getErrorMessage().first()).toBeVisible();
    }

    async verifyModalContainerVisible(): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible();
    }

    /**
     * Verify info icons are displayed (help text is in tooltips)
     */
    async verifyInfoIconsDisplayed(): Promise<void> {
        await expect(this.getGroupNameInfoIcon()).toBeVisible();
        await expect(this.getGroupDisplayNameInfoIcon()).toBeVisible();
        await expect(this.getGroupDescriptionInfoIcon()).toBeVisible();
    }

    // ============================================================================
    // CURRENCY SETTINGS SELECTORS
    // ============================================================================

    protected getAddCurrencyButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.groupSettings.currencySettings.addCurrency });
    }

    protected getRemoveCurrencyButton(code: string): Locator {
        // Remove button has aria-label "Remove {code}"
        return this.getModalContainer().getByRole('button', { name: `Remove ${code}` });
    }

    protected getCurrencySearchInput(): Locator {
        return this.getModalContainer().getByPlaceholder(translation.groupSettings.currencySettings.searchPlaceholder);
    }

    protected getAddCurrencyOption(code: string): Locator {
        // Currency option button shows the currency acronym as visible text
        return this.getModalContainer().getByRole('button', { name: new RegExp(`^${code}\\b`) });
    }

    protected getDefaultCurrencySelect(): Locator {
        // Select has label "Default currency for new expenses"
        return this.getModalContainer().getByLabel(translation.groupSettings.currencySettings.defaultLabel);
    }

    // ============================================================================
    // CURRENCY SETTINGS ACTIONS
    // ============================================================================

    /**
     * Toggle currency restrictions on or off
     */
    async toggleCurrencyRestrictions(): Promise<void> {
        const labelText = this.getModalContainer().getByText(translation.createGroupModal.restrictCurrencies, { exact: true });
        await labelText.scrollIntoViewIfNeeded();
        await labelText.click();
    }

    /**
     * Add a currency to permitted list
     */
    async addPermittedCurrency(code: string): Promise<void> {
        await this.getAddCurrencyButton().click();
        await this.getCurrencySearchInput().fill(code);
        await this.getAddCurrencyOption(code).click();
    }

    /**
     * Set the default currency
     */
    async setDefaultCurrency(code: string): Promise<void> {
        await this.getDefaultCurrencySelect().selectOption(code);
    }

    // ============================================================================
    // CURRENCY SETTINGS VERIFICATION
    // ============================================================================

    /**
     * Verify add currency button is visible (restrictions enabled)
     */
    async verifyAddCurrencyButtonVisible(): Promise<void> {
        await expect(this.getAddCurrencyButton()).toBeVisible();
    }

    /**
     * Verify a specific currency chip is visible in permitted list
     */
    async verifyPermittedCurrencyVisible(code: string): Promise<void> {
        await expect(this.getRemoveCurrencyButton(code)).toBeVisible();
    }

    /**
     * Verify default currency select has expected value
     */
    async verifyDefaultCurrencyValue(code: string): Promise<void> {
        await expect(this.getDefaultCurrencySelect()).toHaveValue(code);
    }
}
