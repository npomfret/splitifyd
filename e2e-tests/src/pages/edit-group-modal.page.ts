import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { DashboardPage } from './dashboard.page.ts';

export class EditGroupModalPage extends BasePage {
    private modal: Locator;
    private saveButton: Locator;
    private nameInput: Locator;
    private descriptionTextarea: Locator;

    constructor(page: Page) {
        super(page);
        this.modal = this.page.getByRole('dialog');
        this.saveButton = this.modal.getByRole('button', { name: 'Save Changes' });
        this.nameInput = this.modal.locator('input[type="text"]').first();
        this.descriptionTextarea = this.modal.locator('textarea').first();
    }

    getModal(): Locator {
        return this.modal;
    }

    getSaveButton(): Locator {
        return this.saveButton;
    }

    getCancelButton(): Locator {
        return this.modal.getByRole('button', { name: 'Cancel' });
    }

    getDeleteButton(): Locator {
        return this.modal.getByRole('button', { name: 'Delete Group' });
    }

    async waitForModalVisible(): Promise<void> {
        await expect(this.modal).toBeVisible();
    }

    async editGroupName(name: string): Promise<void> {
        // Use Preact-aware input filling
        await this.fillPreactInput(this.nameInput, name);

        // Defensive check: verify the value persisted (catches real-time update bug)
        // Use polling to ensure value has stabilized
        await expect(async () => {
            const currentValue = await this.nameInput.inputValue();
            if (currentValue !== name) {
                throw new Error('Form value still changing');
            }
        }).toPass({ timeout: 500, intervals: [50, 100] });

        const currentValue = await this.nameInput.inputValue();
        if (currentValue !== name) {
            throw new Error(`Form field was reset! Expected name "${name}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`);
        }
    }

    async clearGroupName(): Promise<void> {
        // Clear using fillPreactInput with empty string
        await this.fillPreactInput(this.nameInput, '');
        // Trigger blur to ensure validation runs
        await this.nameInput.blur();
    }

    async editDescription(description: string): Promise<void> {
        // Use fillPreactInput for proper Preact signal updates
        await this.fillPreactInput(this.descriptionTextarea, description);

        // Defensive check: verify the value persisted
        await expect(async () => {
            const currentValue = await this.descriptionTextarea.inputValue();
            if (currentValue !== description) {
                throw new Error('Form value still changing');
            }
        }).toPass({ timeout: 500, intervals: [50, 100] });

        const currentValue = await this.descriptionTextarea.inputValue();
        if (currentValue !== description) {
            throw new Error(`Form field was reset! Expected description "${description}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`);
        }
    }

    async saveChanges(): Promise<void> {
        // Double-check form values right before save to ensure they haven't been reset
        const finalName = await this.nameInput.inputValue();
        const finalDesc = await this.descriptionTextarea.inputValue();

        // Validate the form state
        if (!finalName || finalName.trim().length < 2) {
            throw new Error(`Invalid form state before save: name="${finalName}" (minimum 2 characters required). The form may have been reset by a real-time update.`);
        }

        // Wait for button to stabilize in enabled state
        await expect(this.saveButton).toBeEnabled({ timeout: 2000 });

        // Brief stability check - ensure button remains enabled (no race condition)
        await expect(async () => {
            const isEnabled = await this.saveButton.isEnabled();
            if (!isEnabled) {
                throw new Error('Save button became disabled - race condition detected');
            }
        }).toPass({ timeout: 200, intervals: [25, 50] });

        const isStillEnabled = await this.saveButton.isEnabled();
        if (!isStillEnabled) {
            throw new Error(`Save button became disabled after stability check. This indicates a race condition. Form values at time of failure: name="${finalName}", description="${finalDesc}"`);
        }

        await this.saveButton.click();

        // Wait for the modal to close after saving
        // Use a longer timeout as the save operation might take time
        await expect(this.modal).not.toBeVisible({ timeout: 2000 });
        await this.waitForDomContentLoaded();

        // Wait for the data refresh to complete (since no real-time websockets yet)
        // Look for any loading indicators that appear during refresh
        const spinner = this.page.locator('.animate-spin');
        const spinnerCount = await spinner.count();
        if (spinnerCount > 0) {
            // Wait for any spinners to disappear
            await expect(spinner.first()).not.toBeVisible({ timeout: 5000 });
        }

        // Wait for modal to close (indicates data has propagated)
        await expect(this.modal).not.toBeVisible({ timeout: 1000 });
    }

    async cancel(): Promise<void> {
        const cancelButton = this.getCancelButton();
        await cancelButton.click();
    }

    async clickDeleteGroup(): Promise<void> {
        const deleteButton = this.getDeleteButton();
        await deleteButton.click();
    }

    /**
     * Handles the delete confirmation dialog with hard delete confirmation text input
     */
    async handleDeleteConfirmDialog(groupName: string): Promise<DashboardPage> {
        // Wait for confirmation dialog to appear
        // The confirmation dialog appears on top of the edit modal
        await this.waitForDomContentLoaded();

        // The ConfirmDialog component creates a fixed overlay with the Delete Group title
        // Look for the modal content within the overlay - it has "Delete Group" as title
        // and the confirm message
        const confirmTitle = this.page.getByRole('heading', { name: 'Delete Group' });
        await expect(confirmTitle).toBeVisible({ timeout: 5000 });

        // Find the dialog container which is the parent of the title
        const confirmDialog = confirmTitle.locator('..').locator('..');

        // For hard delete, we need to enter the group name in the confirmation text field
        // Find the confirmation text input field
        const confirmationInput = confirmDialog.locator('input[type="text"]');
        await expect(confirmationInput).toBeVisible();

        // Clear any existing text and enter the group name
        await this.fillPreactInput(confirmationInput, groupName);

        // Verify the text was entered correctly
        await expect(confirmationInput).toHaveValue(groupName);

        // Find the Delete button in the confirmation dialog
        const deleteButton = confirmDialog.getByRole('button', { name: 'Delete' });
        await expect(deleteButton).toBeVisible();

        // Wait for the button to be enabled (it's disabled until confirmation text matches group name)
        await expect(deleteButton).toBeEnabled({ timeout: 2000 });

        // Click the delete button
        await deleteButton.click();

        // Wait for the modal to disappear (indicates deletion is processing/complete)
        await expect(confirmDialog).not.toBeVisible({ timeout: 2000 });

        // use should get directed to dashboard
        const dashboardPage = new DashboardPage(this.page, this.userInfo);
        await expect(this.page).toHaveURL(/\/dashboard/);
        await dashboardPage.waitForDashboard();

        return dashboardPage;
    }
}
