import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES } from '../constants/selectors';
import { TIMEOUTS } from '../config/timeouts';
import type { RegisteredUser as BaseUser } from '@splitifyd/shared';
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class CreateGroupModalPage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }
    readonly modalTitle = translationEn.createGroupModal.title;

    async isOpen(): Promise<boolean> {
        // Modal either exists or it doesn't - no ambiguity
        // Use heading role to avoid confusion with button text
        return await this.page.getByRole('heading', { name: this.modalTitle }).isVisible();
    }

    async fillGroupForm(name: string, description?: string) {
        // Wait for modal to be fully visible - use heading to avoid ambiguity
        await this.page.getByRole('heading', { name: this.modalTitle }).waitFor({ state: 'visible' });

        // Fill name input - get fresh locator each time to avoid DOM detachment issues
        const nameInput = this.getGroupNameInput();
        await nameInput.waitFor({ state: 'visible' });
        await expect(nameInput).toBeEnabled();
        await this.fillPreactInput(nameInput, name);

        // Fill description input if provided - get fresh locator to avoid DOM detachment issues
        if (description) {
            const descInput = this.getDescriptionInput();
            await descInput.waitFor({ state: 'visible' });
            await this.fillPreactInput(descInput, description);
        }
    }

    async submitForm() {
        // Get the submit button using the dedicated method for better scoping
        const submitButton = this.getSubmitButton();

        // Wait for button to be ready before clicking
        await submitButton.waitFor({ state: 'visible' });
        await expect(submitButton).toBeEnabled();

        // Use standardized button click with proper error handling
        await this.clickButton(submitButton, { buttonName: translationEn.createGroupModal.submitButton });

        // Check if modal has already closed (instant group creation)
        const modalStillOpen = await this.isOpen();
        
        if (modalStillOpen) {
            // Modal is still open, wait for button to enter loading state
            await expect(async () => {
                // Check if modal is still open inside the polling loop
                const modalStillOpenNow = await this.isOpen();
                if (!modalStillOpenNow) {
                    // Modal closed during polling, no need to check for loading state
                    return;
                }

                const hasSpinner = await submitButton.locator('.animate-spin').count() > 0;
                const ariaBusy = await submitButton.getAttribute('aria-busy');
                const isDisabled = await submitButton.isDisabled();
                
                // Button should either show loading spinner, be marked as busy, or be disabled during submission
                if (!hasSpinner && ariaBusy !== 'true' && !isDisabled) {
                    throw new Error('Button has not entered loading state yet');
                }
            }).toPass({ timeout: 1000 });
        }
        // If modal is already closed, skip the loading state check
    }

    async trySubmitForm(): Promise<boolean> {
        // Attempt to submit form - returns true if successful (modal closes), false if validation prevented submission
        const submitButton = this.page.locator(SELECTORS.FORM).getByRole(ARIA_ROLES.BUTTON, { name: translationEn.createGroupModal.submitButton });

        // Check if button is enabled before attempting to click
        const isEnabled = await submitButton.isEnabled();
        if (!isEnabled) {
            return false; // Form validation prevented submission
        }

        // Button is enabled, attempt to click it
        try {
            await this.clickButton(submitButton, { buttonName: translationEn.createGroupModal.submitButton });

            // Wait a moment for either form submission or validation errors to appear
            await this.page.waitForTimeout(1000);

            // If modal is still open, form validation prevented submission
            const modalStillOpen = await this.isOpen();
            return !modalStillOpen; // Return true if modal closed (successful submission)
        } catch {
            return false; // Click failed for some other reason
        }
    }

    async cancel() {
        // Modal MUST have a cancel/close button - this is basic UX
        // Use a regex that matches either "Cancel" or "Close"
        const cancelButton = this.page.getByRole(ARIA_ROLES.BUTTON, { name: translationEn.createGroupModal.cancelButton });
        await this.clickButton(cancelButton, { buttonName: translationEn.createGroupModal.cancelButton });
    }

    async createGroup(name: string, description?: string) {
        // Ensure modal is open before proceeding
        const isModalOpen = await this.isOpen();
        if (!isModalOpen) {
            throw new Error('Create Group modal is not open');
        }

        // Wait for any modal animation to complete
        await this.page.waitForFunction(
            (selector: string) => {
                const modal = document.querySelector(selector);
                if (!modal) return false;
                const style = window.getComputedStyle(modal);
                return style.opacity === '1' && style.visibility === 'visible';
            },
            SELECTORS.MODAL_OVERLAY,
            { timeout: TIMEOUTS.EXTENDED },
        );

        await this.fillGroupForm(name, description);
        await this.submitForm();

        await this.waitForModalToClose();
    }

    private async waitForButtonSpinnerToDisappear() {
        // First check if modal is still open
        const isModalOpen = await this.isOpen();
        if (!isModalOpen) {
            // Modal already closed, no need to wait for spinner
            return;
        }

        // Wait for spinner to disappear OR modal to close
        await expect(async () => {
            // Check if modal is still open inside the polling loop
            const modalStillOpen = await this.isOpen();
            if (!modalStillOpen) {
                // Modal closed, no need to check for spinner
                return;
            }

            // Modal is still open, check for spinner
            const button = this.getSubmitButton();
            const hasSpinner = await button.locator('.animate-spin').count() > 0;
            const ariaBusy = await button.getAttribute('aria-busy');
            
            if (hasSpinner || ariaBusy === 'true') {
                throw new Error('Button still has spinner/loading state');
            }
        }).toPass({ timeout: 5000 });
    }

    async waitForModalToClose() {
        const isVisible = await this.isOpen();

        if (isVisible) {
            // Wait for any loading spinner to disappear first
            try {
                await this.waitForButtonSpinnerToDisappear();
            } catch {
                // Spinner might have already disappeared if creation was instant
            }

            // Check again if modal is still open after waiting for spinner
            const stillVisible = await this.isOpen();
            if (stillVisible) {
                // Modal is still open, wait for it to close
                await this.page.getByRole('heading', { name: this.modalTitle }).waitFor({ state: 'hidden', timeout: 5000 });
            }
        }
    }

    // Element accessors
    getModalTitle() {
        // Specifically target the modal heading, not buttons with the same text
        return this.page.getByRole('heading', { name: /Create.*New.*Group|New Group/i });
    }

    getGroupNameInput() {
        // Scope to the modal to avoid conflicts with other elements containing "Group Name" text
        return this.page
            .locator('[role="dialog"], .fixed.inset-0')
            .filter({ has: this.page.getByText(translationEn.createGroupModal.title) })
            .getByLabel(translationEn.createGroupModal.groupNameLabel);
    }

    getDescriptionInput() {
        // Scope to the modal to avoid conflicts with other elements
        return this.page
            .locator('[role="dialog"], .fixed.inset-0')
            .filter({ has: this.page.getByText(translationEn.createGroupModal.title) })
            .getByPlaceholder(translationEn.createGroupModal.groupDescriptionPlaceholder);
    }

    getSubmitButton() {
        return this.page
            .locator(SELECTORS.MODAL_OVERLAY)
            .filter({ has: this.page.getByText(translationEn.createGroupModal.title) })
            .getByRole(ARIA_ROLES.BUTTON, { name: translationEn.createGroupModal.submitButton });
    }

    getCreateGroupFormButton() {
        // More direct selector for tests that need the Create Group button in the form
        return this.page.locator(SELECTORS.FORM).getByRole(ARIA_ROLES.BUTTON, { name: translationEn.createGroupModal.submitButton });
    }

    /**
     * Get error message elements for network error testing
     * Updated based on browser debugging - the error appears as a paragraph element in the modal
     */
    getErrorMessage(pattern?: string | RegExp): Locator {
        if (pattern) {
            // Look for error text in various possible containers, including paragraphs inside the modal
            return this.page.locator('.error-message, .text-red-500, .text-danger, [data-testid="error"], [role="dialog"] p, .modal p, .fixed p').filter({ hasText: pattern });
        }
        return this.page.locator('.error-message, .text-red-500, .text-danger, [data-testid="error"], [role="dialog"] p, .modal p, .fixed p');
    }
}
