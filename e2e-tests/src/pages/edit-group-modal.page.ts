import { expect, Page } from '@playwright/test';
import { EditGroupModalPage as BaseEditGroupModalPage } from '@splitifyd/test-support';
import { DashboardPage } from './dashboard.page.ts';

/**
 * E2E-specific EditGroupModalPage that extends the shared base class
 * Adds defensive checks for real-time update race conditions and e2e workflows
 */
export class EditGroupModalPage extends BaseEditGroupModalPage {
    constructor(page: Page) {
        super(page);
    }

    /**
     * E2E version: Edit group name with defensive real-time update verification
     * Overrides base class method to add stability checks
     */
    async editGroupName(name: string): Promise<void> {
        const nameInput = this.getGroupNameInput();

        // Use Preact-aware input filling
        await this.fillPreactInput(nameInput, name);

        // Defensive check: verify the value persisted (catches real-time update bug)
        // Use polling to ensure value has stabilized
        await expect(async () => {
            const currentValue = await nameInput.inputValue();
            if (currentValue !== name) {
                throw new Error('Form value still changing');
            }
        })
            .toPass({ timeout: 500, intervals: [50, 100] });

        const currentValue = await nameInput.inputValue();
        if (currentValue !== name) {
            throw new Error(`Form field was reset! Expected name "${name}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`);
        }
    }

    /**
     * E2E-specific: Clear group name field
     */
    async clearGroupName(): Promise<void> {
        const nameInput = this.getGroupNameInput();
        // Clear using fillPreactInput with empty string
        await this.fillPreactInput(nameInput, '');
        // Trigger blur to ensure validation runs
        await nameInput.blur();
    }

    /**
     * E2E version: Edit description with defensive real-time update verification
     * Overrides base class method to add stability checks
     */
    async editDescription(description: string): Promise<void> {
        const descriptionInput = this.getGroupDescriptionInput();

        // Use fillPreactInput for proper Preact signal updates
        await this.fillPreactInput(descriptionInput, description);

        // Defensive check: verify the value persisted
        await expect(async () => {
            const currentValue = await descriptionInput.inputValue();
            if (currentValue !== description) {
                throw new Error('Form value still changing');
            }
        })
            .toPass({ timeout: 500, intervals: [50, 100] });

        const currentValue = await descriptionInput.inputValue();
        if (currentValue !== description) {
            throw new Error(`Form field was reset! Expected description "${description}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`);
        }
    }

    /**
     * E2E version: Save changes with comprehensive stability verification
     * Overrides base class method to add race condition detection
     */
    async saveChanges(): Promise<void> {
        const nameInput = this.getGroupNameInput();
        const descriptionInput = this.getGroupDescriptionInput();
        const saveButton = this.getSaveButton();

        // Double-check form values right before save to ensure they haven't been reset
        const finalName = await nameInput.inputValue();
        const finalDesc = await descriptionInput.inputValue();

        // Validate the form state
        if (!finalName || finalName.trim().length < 2) {
            throw new Error(`Invalid form state before save: name="${finalName}" (minimum 2 characters required). The form may have been reset by a real-time update.`);
        }

        // Wait for button to stabilize in enabled state
        await expect(saveButton).toBeEnabled({ timeout: 2000 });

        // Brief stability check - ensure button remains enabled (no race condition)
        await expect(async () => {
            const isEnabled = await saveButton.isEnabled();
            if (!isEnabled) {
                throw new Error('Save button became disabled - race condition detected');
            }
        })
            .toPass({ timeout: 200, intervals: [25, 50] });

        const isStillEnabled = await saveButton.isEnabled();
        if (!isStillEnabled) {
            throw new Error(`Save button became disabled after stability check. This indicates a race condition. Form values at time of failure: name="${finalName}", description="${finalDesc}"`);
        }

        await saveButton.click();

        // Wait for the modal to close after saving
        // Use a longer timeout as the save operation might take time
        const modal = this.getModalContainer();
        await expect(modal).not.toBeVisible({ timeout: 2000 });
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
        await expect(modal).not.toBeVisible({ timeout: 1000 });
    }

    /**
     * E2E-specific: Cancel editing (simple wrapper, kept for compatibility)
     */
    async cancel(): Promise<void> {
        const cancelButton = this.getCancelButton();
        await cancelButton.click();
    }

    /**
     * E2E-specific: Click delete group button
     */
    async clickDeleteGroup(): Promise<void> {
        const deleteButton = this.getDeleteButton();
        await deleteButton.click();
    }

    /**
     * E2E-specific workflow: Handles the delete confirmation dialog with hard delete confirmation text input
     * Returns DashboardPage for e2e navigation verification
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
        const dashboardPage = new DashboardPage(this.page);
        await expect(this.page).toHaveURL(/\/dashboard/);
        await dashboardPage.waitForDashboard();

        return dashboardPage;
    }

    /**
     * E2E-specific alias for base class method
     * For backward compatibility with existing tests
     */
    async waitForModalVisible(): Promise<void> {
        await this.waitForModalToOpen();
    }

    /**
     * E2E-specific alias: getModal() → getModalContainer()
     * For backward compatibility with existing tests
     */
    getModal() {
        return this.getModalContainer();
    }
}
