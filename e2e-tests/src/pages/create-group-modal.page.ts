import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES, PLACEHOLDERS } from '../constants/selectors';
import { TIMEOUTS } from '../config/timeouts';
import type { User as BaseUser } from '@splitifyd/shared';
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

        // Get the modal/dialog container to scope our selectors
        // This avoids conflicts with other elements on the page
        const modal = this.page.locator('[role="dialog"], .fixed.inset-0').last();

        // Get the input using a more specific selector - scoped to the modal
        // Use placeholder to be more specific and avoid conflicts
        const nameInput = modal.getByPlaceholder(translationEn.createGroupModal.groupNamePlaceholder);

        // Wait for input to be visible and enabled
        await nameInput.waitFor({ state: 'visible' });
        await expect(nameInput).toBeEnabled();

        // Use the new fillPreactInput utility
        await this.fillPreactInput(nameInput, name);

        if (description) {
            const descInput = modal.getByPlaceholder(PLACEHOLDERS.GROUP_DESCRIPTION);
            await this.fillPreactInput(descInput, description);
        }
    }

    async submitForm() {
        // Get the submit button
        const submitButton = this.page.locator(SELECTORS.FORM).getByRole(ARIA_ROLES.BUTTON, { name: translationEn.createGroupModal.submitButton });

        // Use standardized button click with proper error handling
        await this.clickButton(submitButton, { buttonName: translationEn.createGroupModal.submitButton });
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

    async waitForModalToClose() {
        await this.page.getByRole('heading', { name: this.modalTitle }).waitFor({ state: 'hidden', timeout: 2000 });
    }

    // Element accessors
    getModalTitle() {
        // Specifically target the modal heading, not buttons with the same text
        return this.page.getByRole('heading', { name: /Create.*New.*Group|New Group/i });
    }

    getGroupNameInput() {
        return this.page.getByLabel(translationEn.createGroupModal.groupNameLabel);
    }

    getDescriptionInput() {
        return this.page.getByPlaceholder(translationEn.createGroupModal.groupDescriptionPlaceholder);
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
