import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';
import { translationEn } from '../translations/translation-en';
import { DashboardPage } from './DashboardPage';

const translation = translationEn;

type GroupSettingsTab = 'general' | 'security';

/**
 * Page object for the unified Group Settings modal.
 * Handles both the General tab (group metadata + deletion) and the Security tab (permissions, roles, pending members).
 */
export class GroupSettingsModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER & TAB HELPERS
    // ============================================================================

    getModalContainer(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByTestId('group-settings-modal-title'),
        });
    }

    getDeleteDialog(): Locator {
        return this.page.getByTestId('delete-group-dialog');
    }

    getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]'),
        });
    }

    getTabButton(tab: GroupSettingsTab): Locator {
        return this.getModalContainer().getByTestId(`group-settings-tab-${tab}`);
    }

    async hasTab(tab: GroupSettingsTab): Promise<boolean> {
        return (await this.getTabButton(tab).count()) > 0;
    }

    async ensureGeneralTab(): Promise<void> {
        const nameInput = this.getModalContainer().getByTestId('group-name-input');
        if (await nameInput.count()) {
            try {
                if (await nameInput.isVisible()) {
                    return;
                }
            } catch {
                // fall through and click tab
            }
        }

        if (!(await this.hasTab('general'))) {
            throw new Error('General tab is not available in the Group Settings modal for this user.');
        }

        await this.getTabButton('general').click();
        await expect(nameInput).toBeVisible({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });
    }

    async ensureSecurityTab(): Promise<void> {
        const presetButton = this.getPresetButton('open');
        if (await presetButton.count()) {
            try {
                if (await presetButton.isVisible()) {
                    return;
                }
            } catch {
                // fall through
            }
        }

        if (await this.hasTab('security')) {
            await this.getTabButton('security').click();
        }

        await expect(presetButton).toBeVisible({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });
    }

    // ============================================================================
    // GENERAL TAB - FORM FIELD SELECTORS
    // ============================================================================

    getGroupNameInput(): Locator {
        return this.getModalContainer().getByTestId('group-name-input');
    }

    getGroupDescriptionInput(): Locator {
        return this.getModalContainer().getByTestId('group-description-input');
    }

    // ============================================================================
    // GENERAL TAB - BUTTON SELECTORS
    // ============================================================================

    getSaveButton(): Locator {
        return this.getModalContainer().getByTestId('save-changes-button');
    }

    getCancelButton(): Locator {
        return this.getModalContainer().getByTestId('cancel-edit-group-button');
    }

    getDeleteButton(): Locator {
        return this.getModalContainer().getByTestId('delete-group-button');
    }

    getCloseButton(): Locator {
        return this.getModalContainer().getByTestId('close-group-settings-button');
    }

    getFooterCloseButton(): Locator {
        return this.getModalContainer().getByTestId('group-settings-close-button');
    }

    // ============================================================================
    // SECURITY TAB - SELECTORS
    // ============================================================================

    getPresetButton(preset: string): Locator {
        return this.getModalContainer().getByTestId(`preset-button-${preset}`);
    }

    getSavePermissionsButton(): Locator {
        return this.getModalContainer().getByTestId('save-permissions-button');
    }

    getPermissionSelect(key: string): Locator {
        return this.getModalContainer().getByTestId(`permission-select-${key}`);
    }

    getPendingApproveButton(memberId: string): Locator {
        return this.getModalContainer().getByTestId(`pending-approve-${memberId}`);
    }

    getPendingRejectButton(memberId: string): Locator {
        return this.getModalContainer().getByTestId(`pending-reject-${memberId}`);
    }

    // ============================================================================
    // ERROR MESSAGE SELECTORS
    // ============================================================================

    getValidationError(): Locator {
        return this.getModalContainer().getByTestId('edit-group-validation-error');
    }

    getDeleteError(): Locator {
        return this.getDeleteDialog().locator('[role="alert"]');
    }

    // ============================================================================
    // MODAL LIFECYCLE
    // ============================================================================

    async waitForModalToOpen(options: { tab?: GroupSettingsTab; timeout?: number } = {}): Promise<void> {
        const { tab, timeout = TEST_TIMEOUTS.MODAL_TRANSITION } = options;
        await expect(this.getModalContainer()).toBeVisible({ timeout });

        if (tab === 'security') {
            await this.ensureSecurityTab();
            return;
        }

        if (tab === 'general') {
            await this.ensureGeneralTab();
            return;
        }

        // Default: prefer general tab when available, otherwise security.
        try {
            await this.ensureGeneralTab();
        } catch {
            await this.ensureSecurityTab();
        }
    }

    async waitForModalToClose(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible({ timeout });
    }

    async waitForModalVisible(): Promise<void> {
        await this.waitForModalToOpen();
    }

    getModal(): Locator {
        return this.getModalContainer();
    }

    // ============================================================================
    // GENERAL TAB - FORM ACTIONS
    // ============================================================================

    async fillGroupName(name: string): Promise<void> {
        await this.ensureGeneralTab();
        await this.fillPreactInput(this.getGroupNameInput(), name);
    }

    async editGroupName(name: string): Promise<void> {
        await this.ensureGeneralTab();
        const nameInput = this.getGroupNameInput();
        await this.fillPreactInput(nameInput, name);

        await expect(async () => {
            const currentValue = await nameInput.inputValue();
            if (currentValue !== name) {
                throw new Error('Form value still changing');
            }
        }).toPass({ timeout: 500, intervals: [50, 100] });

        const currentValue = await nameInput.inputValue();
        if (currentValue !== name) {
            throw new Error(
                `Form field was reset! Expected name "${name}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`,
            );
        }
    }

    async clearGroupName(): Promise<void> {
        await this.ensureGeneralTab();
        const nameInput = this.getGroupNameInput();
        await this.fillPreactInput(nameInput, '');
        await nameInput.blur();
    }

    async fillGroupDescription(description: string): Promise<void> {
        await this.ensureGeneralTab();
        const input = this.getGroupDescriptionInput();
        await input.click();
        await input.fill(description);
        await input.dispatchEvent('input');
        await input.blur();
    }

    async editDescription(description: string): Promise<void> {
        await this.ensureGeneralTab();
        const descriptionInput = this.getGroupDescriptionInput();
        await this.fillPreactInput(descriptionInput, description);

        await expect(async () => {
            const currentValue = await descriptionInput.inputValue();
            if (currentValue !== description) {
                throw new Error('Form value still changing');
            }
        }).toPass({ timeout: 500, intervals: [50, 100] });

        const currentValue = await descriptionInput.inputValue();
        if (currentValue !== description) {
            throw new Error(
                `Form field was reset! Expected description "${description}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`,
            );
        }
    }

    async fillGroupForm(name: string, description?: string): Promise<void> {
        await this.fillGroupName(name);
        if (description !== undefined) {
            await this.fillGroupDescription(description);
        }
    }

    async submitForm(): Promise<void> {
        await this.ensureGeneralTab();
        const saveButton = this.getSaveButton();
        await this.clickButton(saveButton, { buttonName: translation.editGroupModal.saveChangesButton });
    }

    async saveChanges(): Promise<void> {
        await this.ensureGeneralTab();
        const nameInput = this.getGroupNameInput();
        const descriptionInput = this.getGroupDescriptionInput();
        const saveButton = this.getSaveButton();

        const finalName = await nameInput.inputValue();
        const finalDesc = await descriptionInput.inputValue();

        if (!finalName || finalName.trim().length < 2) {
            throw new Error(
                `Invalid form state before save: name="${finalName}" (minimum 2 characters required). The form may have been reset by a real-time update.`,
            );
        }

        await expect(saveButton).toBeEnabled({ timeout: 2000 });

        await expect(async () => {
            if (!(await saveButton.isEnabled())) {
                throw new Error('Save button became disabled - race condition detected');
            }
        }).toPass({ timeout: 200, intervals: [25, 50] });

        if (!(await saveButton.isEnabled())) {
            throw new Error(
                `Save button became disabled after stability check. This indicates a race condition. Form values at time of failure: name="${finalName}", description="${finalDesc}"`,
            );
        }

        await saveButton.click();

        const modal = this.getModalContainer();
        await expect(modal).not.toBeVisible({ timeout: 2000 });
        await this.waitForDomContentLoaded();

        const spinner = this.page.locator('.animate-spin');
        if ((await spinner.count()) > 0) {
            await expect(spinner.first()).not.toBeVisible({ timeout: 5000 });
        }

        await expect(modal).not.toBeVisible({ timeout: 1000 });
    }

    async clickCancel(): Promise<void> {
        await this.ensureGeneralTab();
        const button = this.getCancelButton();
        await this.clickButton(button, { buttonName: translation.editGroupModal.cancelButton });
    }

    async clickClose(): Promise<void> {
        await this.getCloseButton().click();
    }

    async clickFooterClose(): Promise<void> {
        if (await this.getFooterCloseButton().count()) {
            await this.getFooterCloseButton().click();
        } else {
            await this.clickClose();
        }
    }

    async clickOutsideToClose(): Promise<void> {
        const backdrop = this.getModalBackdrop();
        await backdrop.click({ position: { x: 10, y: 10 } });
    }

    async pressEscapeToClose(): Promise<void> {
        await super.pressEscapeToClose(this.getModalContainer());
    }

    // ============================================================================
    // GENERAL TAB - DELETE WORKFLOW
    // ============================================================================

    async clickDelete(): Promise<void> {
        await this.ensureGeneralTab();
        const button = this.getDeleteButton();
        await this.clickButton(button, { buttonName: translation.editGroupModal.deleteGroupButton });
        await expect(this.getDeleteDialog()).toBeVisible({ timeout: 2000 });
    }

    async fillDeleteConfirmation(groupName: string): Promise<void> {
        const input = this.getDeleteConfirmationInput();
        await input.click();
        await input.fill(groupName);
        await input.dispatchEvent('input');
    }

    getDeleteConfirmationInput(): Locator {
        return this.getDeleteDialog().locator('input[type="text"]');
    }

    getConfirmDeleteButton(): Locator {
        return this
            .getDeleteDialog()
            .getByRole('button', { name: /delete/i })
            .last();
    }

    getCancelDeleteButton(): Locator {
        return this.getDeleteDialog().getByRole('button', { name: /cancel/i });
    }

    async confirmDelete(): Promise<void> {
        const button = this.getConfirmDeleteButton();
        await this.clickButton(button, { buttonName: translation.editGroupModal.deleteConfirmDialog.confirmText });
    }

    async cancelDelete(): Promise<void> {
        const button = this.getCancelDeleteButton();
        await this.clickButton(button, { buttonName: translation.editGroupModal.deleteConfirmDialog.cancelText });
    }

    async deleteGroup(groupName: string): Promise<void> {
        await this.clickDelete();
        await this.fillDeleteConfirmation(groupName);
        await this.confirmDelete();
    }

    // ============================================================================
    // SECURITY TAB - ACTIONS
    // ============================================================================

    async waitForSecurityTab(): Promise<void> {
        await this.ensureSecurityTab();
    }

    async selectPreset(preset: string): Promise<void> {
        await this.ensureSecurityTab();
        await this.getPresetButton(preset).click();
    }

    async savePermissions(): Promise<void> {
        await this.ensureSecurityTab();
        await this.getSavePermissionsButton().click();
    }

    async selectPermission(key: string, option: string): Promise<void> {
        await this.ensureSecurityTab();
        const select = this.getPermissionSelect(key);
        await select.selectOption(option);
    }

    async approvePendingMember(memberId: string): Promise<void> {
        await this.ensureSecurityTab();
        await this.getPendingApproveButton(memberId).click();
    }

    async rejectPendingMember(memberId: string): Promise<void> {
        await this.ensureSecurityTab();
        await this.getPendingRejectButton(memberId).click();
    }

    // ============================================================================
    // VERIFICATION HELPERS
    // ============================================================================

    async verifyModalOpen(): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible();
        await this.ensureGeneralTab();
        await expect(this.getGroupNameInput()).toBeVisible();
        await expect(this.getGroupDescriptionInput()).toBeVisible();
        await expect(this.getSaveButton()).toBeVisible();
        await expect(this.getCancelButton()).toBeVisible();
        await expect(this.getDeleteButton()).toBeVisible();
    }

    async verifyModalClosed(): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible();
    }

    async verifyFormValues(expectedName: string, expectedDescription?: string): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getGroupNameInput()).toHaveValue(expectedName);
        if (expectedDescription !== undefined) {
            await expect(this.getGroupDescriptionInput()).toHaveValue(expectedDescription);
        }
    }

    async verifySaveButtonState(shouldBeEnabled: boolean): Promise<void> {
        await this.ensureGeneralTab();
        if (shouldBeEnabled) {
            await expect(this.getSaveButton()).toBeEnabled();
        } else {
            await expect(this.getSaveButton()).toBeDisabled();
        }
    }

    async verifyValidationError(expectedMessage: string): Promise<void> {
        await expect(this.getValidationError()).toBeVisible();
        await expect(this.getValidationError()).toContainText(expectedMessage);
    }

    async verifyNoValidationError(): Promise<void> {
        await expect(this.getValidationError()).not.toBeVisible();
    }

    async verifyDeleteDialogOpen(): Promise<void> {
        await expect(this.getDeleteDialog()).toBeVisible();
        await expect(this.getDeleteConfirmationInput()).toBeVisible();
        await expect(this.getConfirmDeleteButton()).toBeVisible();
        await expect(this.getCancelDeleteButton()).toBeVisible();
    }

    async verifyDeleteDialogClosed(): Promise<void> {
        await expect(this.getDeleteDialog()).not.toBeVisible();
    }

    async verifyConfirmDeleteButtonState(shouldBeEnabled: boolean): Promise<void> {
        const confirmButton = this.getConfirmDeleteButton();
        if (shouldBeEnabled) {
            await expect(confirmButton).toBeEnabled();
        } else {
            await expect(confirmButton).toBeDisabled();
        }
    }

    async verifySaveButtonDisabled(): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getSaveButton()).toBeDisabled();
    }

    async clickSaveButton(): Promise<void> {
        await this.submitForm();
    }

    async clickCancelButton(): Promise<void> {
        await this.clickCancel();
    }

    async cancel(): Promise<void> {
        await this.clickCancel();
    }

    async clickDeleteGroup(): Promise<void> {
        await this.clickDelete();
    }

    async handleDeleteConfirmDialog<T = DashboardPage>(
        groupName: string,
        createDashboardPage?: (page: Page) => T,
    ): Promise<T> {
        await this.waitForDomContentLoaded();

        const confirmTitle = this.page.getByRole('heading', { name: translation.editGroupModal.deleteConfirmDialog.title });
        await expect(confirmTitle).toBeVisible({ timeout: 5000 });

        const confirmDialog = confirmTitle.locator('..').locator('..');
        const confirmationInput = confirmDialog.locator('input[type="text"]');
        await expect(confirmationInput).toBeVisible();

        await this.fillPreactInput(confirmationInput, groupName);
        await expect(confirmationInput).toHaveValue(groupName);

        const deleteButton = confirmDialog.getByRole('button', { name: translation.editGroupModal.deleteConfirmDialog.confirmText });
        await expect(deleteButton).toBeVisible();
        await expect(deleteButton).toBeEnabled({ timeout: 2000 });
        await deleteButton.click();

        await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });
        await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 5000 });

        const dashboardPage = (createDashboardPage
            ? createDashboardPage(this.page)
            : (new DashboardPage(this.page) as unknown as T));

        const dashboardGuards = dashboardPage as unknown as {
            waitForDashboard?: () => Promise<void>;
            verifyDashboardPageLoaded?: () => Promise<void>;
        };

        if (typeof dashboardGuards.waitForDashboard === 'function') {
            await dashboardGuards.waitForDashboard();
        } else if (typeof dashboardGuards.verifyDashboardPageLoaded === 'function') {
            await dashboardGuards.verifyDashboardPageLoaded();
        }

        const spinner = this.page.locator('.animate-spin');
        await expect(spinner).not.toBeVisible({ timeout: 5000 });

        return dashboardPage;
    }
}
