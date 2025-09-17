import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES } from '../constants/selectors';
import { TIMEOUTS } from '../config/timeouts';
import { PooledTestUser } from '@splitifyd/shared';
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class CreateGroupModalPage extends BasePage {
    readonly modalTitle = translationEn.createGroupModal.title;

    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }

    async isOpen(): Promise<boolean> {
        // Modal either exists or it doesn't - no ambiguity
        // Use heading role to avoid confusion with button text
        return await this.page.getByRole('heading', { name: this.modalTitle }).isVisible();
    }

    async fillGroupForm(name: string, description?: string) {
        // First verify the modal is actually open - fail fast with clear error
        const isModalOpen = await this.isOpen();
        if (!isModalOpen) {
            throw new Error(`Cannot fill group form - Create Group modal is not open. Make sure to call openCreateGroupModal() first.`);
        }

        // Wait for modal to be fully visible - use heading to avoid ambiguity
        await this.page.getByRole('heading', { name: this.modalTitle }).waitFor({ state: 'visible' });

        // Fill name input - get fresh locator each time to avoid DOM detachment issues
        const nameInput = this.getGroupNameInput();
        await nameInput.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
            throw new Error(`Group name input field not found in modal. Modal may not have rendered properly.`);
        });
        await expect(nameInput).toBeEnabled({ timeout: 2000 });
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

        // Note: We don't wait for loading states here because operations can be instantaneous.
        // The caller (createGroup method) will handle waiting for the appropriate outcome.
    }

    async cancel() {
        // Modal MUST have a cancel/close button - this is basic UX
        // Wait for modal to be fully rendered including buttons
        await this.page.waitForLoadState('domcontentloaded');

        // Target Cancel button specifically within the modal dialog context
        const modalDialog = this.page.getByRole('dialog');
        const cancelButton = modalDialog.getByRole(ARIA_ROLES.BUTTON, { name: translationEn.createGroupModal.cancelButton, exact: true });

        // Wait for button to be visible before clicking
        await expect(cancelButton).toBeVisible({ timeout: 5000 });
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
        // Simply wait for the modal to close - don't worry about intermediate states
        await expect(async () => {
            const isOpen = await this.isOpen();
            if (isOpen) {
                throw new Error('Modal still open');
            }
        }).toPass({ timeout: 5000, intervals: [100, 250] });
    }

    getGroupNameInput() {
        // Our modal always has role="dialog" - if it doesn't, our app is broken
        return this.page.getByRole('dialog').getByLabel(translationEn.createGroupModal.groupNameLabel);
    }

    getDescriptionInput() {
        // Our modal always has role="dialog" - if it doesn't, our app is broken
        return this.page.getByRole('dialog').getByPlaceholder(translationEn.createGroupModal.groupDescriptionPlaceholder);
    }

    getSubmitButton() {
        // Our modal always has role="dialog" - if it doesn't, our app is broken
        return this.page.getByRole('dialog').getByRole(ARIA_ROLES.BUTTON, { name: translationEn.createGroupModal.submitButton });
    }

    getCreateGroupFormButton() {
        // More direct selector for tests that need the Create Group button in the form
        return this.page.locator(SELECTORS.FORM).getByRole(ARIA_ROLES.BUTTON, { name: translationEn.createGroupModal.submitButton });
    }

    /**
     * Get error message elements for network error testing
     * Updated to target the specific error message element in CreateGroupModal
     */
    getErrorMessage(pattern?: string | RegExp): Locator {
        // First try the specific testid for create group errors
        const specificError = this.page.locator('[data-testid="create-group-error-message"]');

        // Then try generic error selectors
        const genericErrors = this.page.locator('[role="alert"], [data-testid*="error"], .error-message, [role="dialog"] [role="alert"]');

        // Combine both selectors
        const allErrors = this.page.locator('[data-testid="create-group-error-message"], [role="alert"], [data-testid*="error"], .error-message, [role="dialog"] [role="alert"]');

        if (pattern) {
            return allErrors.filter({ hasText: pattern });
        }
        return allErrors;
    }
}
