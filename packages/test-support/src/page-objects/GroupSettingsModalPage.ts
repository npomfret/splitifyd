import { expect, Locator, Page } from '@playwright/test';
import type { GroupName } from '@billsplit-wl/shared';
import { TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { DashboardPage } from './DashboardPage';

const translation = translationEn;

type GroupSettingsTab = 'identity' | 'general' | 'security';

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

    protected getModalContainer(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.getByTestId('group-settings-modal-title'),
        });
    }

    protected getDeleteDialog(): Locator {
        return this.page.getByTestId('delete-group-dialog');
    }

    protected getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]'),
        });
    }

    protected getTabButton(tab: GroupSettingsTab): Locator {
        return this.getModalContainer().getByTestId(`group-settings-tab-${tab}`);
    }

    async hasTab(tab: GroupSettingsTab): Promise<boolean> {
        return (await this.getTabButton(tab).count()) > 0;
    }

    async ensureGeneralTab(): Promise<void> {
        const groupNameInput = this.getGroupNameInput();

        if ((await groupNameInput.count()) > 0) {
            try {
                if (await groupNameInput.isVisible()) {
                    // Wait for input to be editable to ensure modal is stable
                    await expect(groupNameInput).toBeEditable({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });
                    return;
                }
            } catch {
                // ignore visibility race, fall through to tab click when possible
            }
        }

        if (await this.hasTab('general')) {
            await this.getTabButton('general').click();
        } else if ((await groupNameInput.count()) === 0) {
            throw new Error('General tab content was not found in the Group Settings modal.');
        }

        // Wait for input to be editable (not just visible) to ensure modal is stable
        await expect(groupNameInput).toBeEditable({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });
    }

    async ensureIdentityTab(): Promise<void> {
        const displayNameInput = this.getDisplayNameInput();

        if ((await displayNameInput.count()) > 0) {
            try {
                if (await displayNameInput.isVisible()) {
                    // Wait for input to be editable to ensure modal is stable
                    await expect(displayNameInput).toBeEditable({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });
                    return;
                }
            } catch {
                // ignore and fall through to tab navigation
            }
        }

        if (await this.hasTab('identity')) {
            await this.getTabButton('identity').click();
        } else if ((await displayNameInput.count()) === 0) {
            throw new Error('Identity tab content was not found in the Group Settings modal.');
        }

        // Wait for input to be editable (not just visible) to ensure modal is stable
        await expect(displayNameInput).toBeEditable({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });
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

    protected getGroupNameInput(): Locator {
        return this.getModalContainer().getByTestId('group-name-input');
    }

    protected getGroupDescriptionInput(): Locator {
        return this.getModalContainer().getByTestId('group-description-input');
    }

    // ============================================================================
    // GENERAL TAB - DISPLAY NAME SELECTORS
    // ============================================================================

    protected getDisplayNameSection(): Locator {
        return this.getModalContainer().getByTestId('group-display-name-settings');
    }

    protected getDisplayNameInput(): Locator {
        return this.getModalContainer().getByTestId('group-display-name-input');
    }

    protected getDisplayNameSaveButton(): Locator {
        return this.getModalContainer().getByTestId('group-display-name-save-button');
    }

    protected getDisplayNameError(): Locator {
        return this.getModalContainer().getByTestId('group-display-name-error');
    }

    protected getDisplayNameSuccess(): Locator {
        return this.getModalContainer().getByTestId('group-display-name-success');
    }

    // ============================================================================
    // GENERAL TAB - BUTTON SELECTORS
    // ============================================================================

    protected getSaveButton(): Locator {
        return this.getModalContainer().getByTestId('save-changes-button');
    }

    protected getCancelButton(): Locator {
        return this.getModalContainer().getByTestId('cancel-edit-group-button');
    }

    protected getDeleteButton(): Locator {
        return this.getModalContainer().getByTestId('delete-group-button');
    }

    protected getCloseButton(): Locator {
        return this.getModalContainer().getByTestId('close-group-settings-button');
    }

    protected getFooterCloseButton(): Locator {
        return this.getModalContainer().getByTestId('group-settings-close-button');
    }

    // ============================================================================
    // SECURITY TAB - SELECTORS
    // ============================================================================

    protected getPresetButton(preset: string): Locator {
        return this.getModalContainer().getByTestId(`preset-button-${preset}`);
    }

    protected getSecuritySaveButton(): Locator {
        return this.getModalContainer().getByTestId('save-security-button');
    }

    protected getPermissionSelect(key: string): Locator {
        return this.getModalContainer().getByTestId(`permission-select-${key}`);
    }

    protected getPendingApproveButton(memberId: string): Locator {
        return this.getModalContainer().getByTestId(`pending-approve-${memberId}`);
    }

    protected getPendingRejectButton(memberId: string): Locator {
        return this.getModalContainer().getByTestId(`pending-reject-${memberId}`);
    }

    // ============================================================================
    // ERROR MESSAGE SELECTORS
    // ============================================================================

    protected getValidationError(): Locator {
        return this.getModalContainer().getByTestId('edit-group-validation-error');
    }

    async waitForModalToOpen(options: { tab?: GroupSettingsTab; timeout?: number; } = {}): Promise<void> {
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

        if (tab === 'identity') {
            await this.ensureIdentityTab();
            return;
        }

        // Default: prefer identity, then general, then security.
        try {
            await this.ensureIdentityTab();
        } catch {
            try {
                await this.ensureGeneralTab();
            } catch {
                await this.ensureSecurityTab();
            }
        }
    }

    protected getModal(): Locator {
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
        })
            .toPass({ timeout: 500, intervals: [50, 100] });

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
        })
            .toPass({ timeout: 500, intervals: [50, 100] });

        const currentValue = await descriptionInput.inputValue();
        if (currentValue !== description) {
            throw new Error(
                `Form field was reset! Expected description "${description}" but got "${currentValue}". This indicates a real-time update bug where the modal resets user input.`,
            );
        }
    }

    protected getGeneralSuccessAlert(): Locator {
        return this.getModalContainer().getByTestId('group-general-success');
    }

    protected getSecuritySuccessAlert(): Locator {
        return this.getModalContainer().getByTestId('security-permissions-success');
    }

    protected getSecurityUnsavedBanner(): Locator {
        return this.getModalContainer().getByTestId('security-unsaved-banner');
    }

    async submitForm(): Promise<void> {
        await this.ensureGeneralTab();
        const saveButton = this.getSaveButton();
        await this.clickButton(saveButton, { buttonName: translation.common.save });
    }

    async fillDisplayName(name: string): Promise<void> {
        await this.ensureIdentityTab();
        const input = this.getDisplayNameInput();
        await expect(input).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        await input.click();
        await input.fill('');
        await input.dispatchEvent('input');

        await input.fill(name);
        await input.dispatchEvent('input');

        await expect(input).toHaveValue(name, { timeout: TEST_TIMEOUTS.INPUT_UPDATE });
    }

    async saveDisplayName(): Promise<void> {
        await this.ensureIdentityTab();
        const saveButton = this.getDisplayNameSaveButton();
        await this.clickButton(saveButton, { buttonName: translation.common.save });
    }

    async saveChanges(): Promise<void> {
        await this.ensureGeneralTab();
        const nameInput = this.getGroupNameInput();
        const saveButton = this.getSaveButton();

        const finalName = await nameInput.inputValue();

        if (!finalName || finalName.trim().length < 2) {
            throw new Error(
                `Invalid form state before save: name="${finalName}" (minimum 2 characters required). The form may have been reset by a real-time update.`,
            );
        }

        await expect(saveButton).toBeEnabled({ timeout: 2000 });
        await this.clickButton(saveButton, { buttonName: translation.common.save });
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
        // Wait for either the footer close button or the X close button to be visible
        const footerCloseButton = this.getFooterCloseButton();
        const xCloseButton = this.getCloseButton();

        // Try footer close button first (preferred), fall back to X button
        try {
            await expect(footerCloseButton).toBeVisible({ timeout: 2000 });
            await footerCloseButton.click();
        } catch {
            await expect(xCloseButton).toBeVisible({ timeout: 2000 });
            await xCloseButton.click();
        }
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

    async fillDeleteConfirmation(groupName: GroupName): Promise<void> {
        const input = this.getDeleteConfirmationInput();
        await input.click();
        await input.fill(groupName);
        await input.dispatchEvent('input');
    }

    protected getDeleteConfirmationInput(): Locator {
        return this.getDeleteDialog().locator('input[type="text"]');
    }

    protected getConfirmDeleteButton(): Locator {
        return this
            .getDeleteDialog()
            .getByRole('button', { name: /delete/i })
            .last();
    }

    protected getCancelDeleteButton(): Locator {
        return this.getDeleteDialog().getByRole('button', { name: /cancel/i });
    }

    async confirmDelete(): Promise<void> {
        const button = this.getConfirmDeleteButton();
        await this.clickButton(button, { buttonName: translation.editGroupModal.deleteConfirmDialog.confirmText });
    }

    async deleteGroup(groupName: GroupName): Promise<void> {
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

    async waitForPendingMember(memberId: string, timeout: number = 15000): Promise<void> {
        // Use toPass() to retry both ensuring the tab and waiting for the button
        // This handles race conditions where the tab might not be fully loaded or
        // the pending member data hasn't been fetched yet
        await expect(async () => {
            await this.ensureSecurityTab();
            const button = this.getPendingApproveButton(memberId);
            await expect(button).toBeVisible({ timeout: 2000 });
        })
            .toPass({ timeout });
    }

    async selectPreset(preset: string): Promise<void> {
        await this.ensureSecurityTab();
        await this.getPresetButton(preset).click();
    }

    async saveSecuritySettings(): Promise<void> {
        await this.ensureSecurityTab();
        const saveButton = this.getSecuritySaveButton();
        // Retry clicking the save button if it becomes disabled due to real-time updates
        await expect(async () => {
            await expect(saveButton).toBeEnabled();
            await this.clickButton(saveButton, { buttonName: translation.common.save });
        })
            .toPass({ timeout: 8000 });
    }

    async approveMember(memberId: string): Promise<void> {
        await this.ensureSecurityTab();
        await this.getPendingApproveButton(memberId).click();
        // Wait for the pending members list to update after approval
        await expect(this.getPendingApproveButton(memberId)).toHaveCount(0, { timeout: 5000 });
    }

    async rejectMember(memberId: string): Promise<void> {
        await this.ensureSecurityTab();
        await this.getPendingRejectButton(memberId).click();
        // Wait for the pending members list to update after rejection
        await expect(this.getPendingRejectButton(memberId)).toHaveCount(0, { timeout: 5000 });
    }

    // ============================================================================
    // VERIFICATION HELPERS
    // ============================================================================

    async verifyModalNotVisible(): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible();
    }

    async verifyModalOpen(): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible();
        await this.ensureGeneralTab();
        await expect(this.getGroupNameInput()).toBeVisible();
        await expect(this.getGroupDescriptionInput()).toBeVisible();
        await expect(this.getSaveButton()).toBeVisible();
        await expect(this.getCancelButton()).toBeVisible();
        await expect(this.getDeleteButton()).toBeVisible();
    }

    async verifyGeneralSuccessAlertVisible(): Promise<void> {
        await expect(this.getGeneralSuccessAlert()).toBeVisible();
    }

    async verifySaveButtonDisabled(): Promise<void> {
        await expect(this.getSaveButton()).toBeDisabled();
    }

    async verifySaveButtonEnabled(): Promise<void> {
        await expect(this.getSaveButton()).toBeEnabled();
    }

    async verifyModalVisible(): Promise<void> {
        await expect(this.getModal()).toBeVisible();
    }

    async cancel(): Promise<void> {
        await this.clickCancel();
    }

    async clickDeleteGroup(): Promise<void> {
        await this.clickDelete();
    }

    async handleDeleteConfirmDialog<T = DashboardPage>(
        groupName: GroupName | string,
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

        const dashboardPage = createDashboardPage
            ? createDashboardPage(this.page)
            : (new DashboardPage(this.page) as unknown as T);

        const dashboardGuards = dashboardPage as unknown as {
            waitForDashboard?: () => Promise<void>;
            verifyDashboardPageLoaded?: () => Promise<void>;
        };

        if (typeof dashboardGuards.waitForDashboard === 'function') {
            await dashboardGuards.waitForDashboard();
        } else if (typeof dashboardGuards.verifyDashboardPageLoaded === 'function') {
            await dashboardGuards.verifyDashboardPageLoaded();
        }

        const spinner = this.page.getByTestId('loading-spinner');
        await expect(spinner).not.toBeVisible({ timeout: 5000 });

        return dashboardPage;
    }

    /**
     * Verify security unsaved banner is visible
     */
    async verifySecurityUnsavedBannerVisible(): Promise<void> {
        await expect(this.getSecurityUnsavedBanner()).toBeVisible();
    }

    /**
     * Verify security unsaved banner is not visible
     */
    async verifySecurityUnsavedBannerNotVisible(): Promise<void> {
        await expect(this.getSecurityUnsavedBanner()).not.toBeVisible();
    }

    /**
     * Verify security success alert is visible
     */
    async verifySecuritySuccessAlertVisible(): Promise<void> {
        await expect(this.getSecuritySuccessAlert()).toBeVisible();
    }

    /**
     * Verify security success alert is not visible
     */
    async verifySecuritySuccessAlertNotVisible(): Promise<void> {
        await expect(this.getSecuritySuccessAlert()).not.toBeVisible();
    }

    /**
     * Verify display name section is visible
     */
    async verifyDisplayNameSectionVisible(): Promise<void> {
        await expect(this.getDisplayNameSection()).toBeVisible();
    }

    /**
     * Verify display name input is visible
     */
    async verifyDisplayNameInputVisible(): Promise<void> {
        await expect(this.getDisplayNameInput()).toBeVisible();
    }

    /**
     * Verify display name save button is visible
     */
    async verifyDisplayNameSaveButtonVisible(): Promise<void> {
        await expect(this.getDisplayNameSaveButton()).toBeVisible();
    }

    /**
     * Verify display name save button is disabled
     */
    async verifyDisplayNameSaveButtonDisabled(): Promise<void> {
        await expect(this.getDisplayNameSaveButton()).toBeDisabled();
    }

    /**
     * Verify display name error is visible
     */
    async verifyDisplayNameErrorVisible(): Promise<void> {
        await expect(this.getDisplayNameError()).toBeVisible();
    }

    /**
     * Verify display name success is visible
     */
    async verifyDisplayNameSuccessVisible(): Promise<void> {
        await expect(this.getDisplayNameSuccess()).toBeVisible();
    }

    /**
     * Verify display name success is not visible
     */
    async verifyDisplayNameSuccessNotVisible(): Promise<void> {
        await expect(this.getDisplayNameSuccess()).not.toBeVisible();
    }

    /**
     * Verify pending approve button is visible
     */
    async verifyPendingApproveButtonVisible(memberId: string): Promise<void> {
        await expect(this.getPendingApproveButton(memberId)).toBeVisible();
    }

    /**
     * Verify pending approve button is not visible
     */
    async verifyPendingApproveButtonNotVisible(memberId: string): Promise<void> {
        await expect(this.getPendingApproveButton(memberId)).not.toBeVisible();
    }

    /**
     * Verify pending reject button is visible
     */
    async verifyPendingRejectButtonVisible(memberId: string): Promise<void> {
        await expect(this.getPendingRejectButton(memberId)).toBeVisible();
    }

    /**
     * Verify pending reject button is not visible
     */
    async verifyPendingRejectButtonNotVisible(memberId: string): Promise<void> {
        await expect(this.getPendingRejectButton(memberId)).not.toBeVisible();
    }

    /**
     * Verify modal container is visible
     */
    async verifyModalContainerVisible(): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible();
    }

    /**
     * Verify modal container is not visible
     */
    async verifyModalContainerNotVisible(): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible();
    }

    // Public locator accessors for tests
    getDisplayNameInputLocator(): Locator {
        return this.getDisplayNameInput();
    }

    getDisplayNameSaveButtonLocator(): Locator {
        return this.getDisplayNameSaveButton();
    }

    getDisplayNameSuccessLocator(): Locator {
        return this.getDisplayNameSuccess();
    }

    getDisplayNameSectionLocator(): Locator {
        return this.getDisplayNameSection();
    }

    getDisplayNameErrorLocator(): Locator {
        return this.getDisplayNameError();
    }

    getPendingApproveButtonLocator(memberId: string): Locator {
        return this.getPendingApproveButton(memberId);
    }

    getPendingRejectButtonLocator(memberId: string): Locator {
        return this.getPendingRejectButton(memberId);
    }

    getModalContainerLocator(): Locator {
        return this.getModalContainer();
    }

    /**
     * Verify "No pending requests" message is visible after all pending members are processed
     */
    async verifyNoPendingRequestsMessageVisible(): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getModalContainer().getByText('No pending requests right now.')).toBeVisible();
    }
}
