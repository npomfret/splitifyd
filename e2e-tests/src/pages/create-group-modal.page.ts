import { expect } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES, PLACEHOLDERS } from '../constants/selectors';
import { TIMEOUTS } from '../config/timeouts';

export class CreateGroupModalPage extends BasePage {
    readonly modalTitle = 'Create New Group';

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
        const nameInput = modal.getByPlaceholder('e.g., Apartment Expenses, Trip to Paris');

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
        const submitButton = this.page.locator(SELECTORS.FORM).getByRole(ARIA_ROLES.BUTTON, { name: 'Create Group' });

        // Use standardized button click with proper error handling
        await this.clickButton(submitButton, { buttonName: 'Create Group' });
    }

    async cancel() {
        // Modal MUST have a cancel/close button - this is basic UX
        // Use a regex that matches either "Cancel" or "Close"
        const cancelButton = this.page.getByRole(ARIA_ROLES.BUTTON, { name: /(Cancel|Close)/i });
        await this.clickButton(cancelButton, { buttonName: 'Cancel' });
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
        return this.page.getByLabel('Group Name*');
    }

    getDescriptionInput() {
        return this.page.getByPlaceholder(/Add any details/i);
    }

    getSubmitButton() {
        return this.page
            .locator(SELECTORS.MODAL_OVERLAY)
            .filter({ has: this.page.getByText('Create New Group') })
            .getByRole(ARIA_ROLES.BUTTON, { name: 'Create Group' });
    }

    getCreateGroupFormButton() {
        // More direct selector for tests that need the Create Group button in the form
        return this.page.locator(SELECTORS.FORM).getByRole(ARIA_ROLES.BUTTON, { name: 'Create Group' });
    }
}
