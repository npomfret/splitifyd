import type { GroupName } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
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
        return this.page.getByRole('dialog', { name: translation.groupSettingsModal.title });
    }

    protected getDeleteDialog(): Locator {
        return this.page.getByRole('dialog', { name: translation.editGroupModal.deleteConfirmDialog.title });
    }

    protected getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]'),
        });
    }

    protected getTabButton(tab: GroupSettingsTab): Locator {
        // Map tab to translation key for the tab name
        const tabNames: Record<GroupSettingsTab, string> = {
            identity: translation.groupSettingsModal.tabs.identity,
            general: translation.groupSettingsModal.tabs.general,
            security: translation.groupSettingsModal.tabs.security,
        };
        return this.getModalContainer().getByRole('tab', { name: tabNames[tab] });
    }

    async hasTab(tab: GroupSettingsTab): Promise<boolean> {
        return (await this.getTabButton(tab).count()) > 0;
    }

    async ensureGeneralTab(): Promise<void> {
        const groupNameInput = this.getGroupNameInput();
        const generalTabButton = this.getTabButton('general');

        // Use polling to handle race conditions with React's useEffect resetting the active tab.
        // The modal's useModalOpen hook may reset the tab after our click, so we need to retry.
        await expect(async () => {
            // Check if already on General tab (input visible and editable)
            if ((await groupNameInput.count()) > 0 && await groupNameInput.isVisible()) {
                await expect(groupNameInput).toBeEditable({ timeout: 500 });
                return; // Success - we're on General tab
            }

            // Not on General tab - click the tab button if it exists
            if ((await generalTabButton.count()) > 0) {
                await generalTabButton.click();
            }

            // Verify tab switched successfully
            await expect(groupNameInput).toBeVisible({ timeout: 500 });
            await expect(groupNameInput).toBeEditable({ timeout: 500 });
        }).toPass({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION, intervals: [100, 200, 500] });
    }

    async ensureIdentityTab(): Promise<void> {
        const displayNameInput = this.getDisplayNameInput();
        const identityTabButton = this.getTabButton('identity');

        // Use polling to handle race conditions with React's useEffect resetting the active tab.
        await expect(async () => {
            // Check if already on Identity tab (input visible and editable)
            if ((await displayNameInput.count()) > 0 && await displayNameInput.isVisible()) {
                await expect(displayNameInput).toBeEditable({ timeout: 500 });
                return; // Success - we're on Identity tab
            }

            // Not on Identity tab - click the tab button if it exists
            if ((await identityTabButton.count()) > 0) {
                await identityTabButton.click();
            }

            // Verify tab switched successfully
            await expect(displayNameInput).toBeVisible({ timeout: 500 });
            await expect(displayNameInput).toBeEditable({ timeout: 500 });
        }).toPass({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION, intervals: [100, 200, 500] });
    }

    async ensureSecurityTab(): Promise<void> {
        const presetButton = this.getPresetButton('open');
        const securityTabButton = this.getTabButton('security');

        // Use polling to handle race conditions with React's useEffect resetting the active tab.
        await expect(async () => {
            // Check if already on Security tab (preset button visible)
            if ((await presetButton.count()) > 0 && await presetButton.isVisible()) {
                return; // Success - we're on Security tab
            }

            // Not on Security tab - click the tab button if it exists
            if ((await securityTabButton.count()) > 0) {
                await securityTabButton.click();
            }

            // Verify tab switched successfully
            await expect(presetButton).toBeVisible({ timeout: 500 });
        }).toPass({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION, intervals: [100, 200, 500] });
    }

    // ============================================================================
    // GENERAL TAB - FORM FIELD SELECTORS
    // ============================================================================

    protected getGroupNameInput(): Locator {
        return this.getModalContainer().getByLabel(translation.editGroupModal.groupNameLabel);
    }

    protected getGroupDescriptionInput(): Locator {
        return this.getModalContainer().getByLabel(translation.editGroupModal.descriptionLabel);
    }

    // ============================================================================
    // GENERAL TAB - DISPLAY NAME SELECTORS
    // ============================================================================

    protected getDisplayNameSection(): Locator {
        // The section contains the display name heading
        return this.getModalContainer().locator('section').filter({
            has: this.page.getByText(translation.groupDisplayNameSettings.title, { exact: true }),
        });
    }

    protected getDisplayNameInput(): Locator {
        return this.getModalContainer().getByLabel(translation.groupDisplayNameSettings.inputLabel);
    }

    protected getDisplayNameSaveButton(): Locator {
        // Save button in the identity/display name section (within the form)
        return this.getDisplayNameSection().getByRole('button', { name: translation.common.save });
    }

    protected getDisplayNameError(): Locator {
        // Alert role for error messages in the display name section
        return this.getDisplayNameSection().getByRole('alert');
    }

    protected getDisplayNameSuccess(): Locator {
        // Status role for success messages in the display name section
        return this.getDisplayNameSection().getByRole('status');
    }

    // ============================================================================
    // GENERAL TAB - BUTTON SELECTORS
    // ============================================================================

    protected getSaveButton(): Locator {
        // Modal has two Save buttons: one in identity section, one in general tab footer.
        // We want the footer button (last in DOM order). Using .last() is intentional.
        return this.getModalContainer().getByRole('button', { name: translation.common.save }).last();
    }

    protected getCancelButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.editGroupModal.cancelButton });
    }

    protected getDangerZoneSection(): Locator {
        // The danger zone section contains the "Danger Zone" heading
        return this.getModalContainer().locator('section').filter({
            has: this.page.getByText(translation.groupSettingsModal.sections.dangerZone, { exact: true }),
        });
    }

    protected getDeleteButton(): Locator {
        // Delete button is now in the Danger Zone section at the bottom
        return this.getDangerZoneSection().getByRole('button', { name: translation.editGroupModal.deleteGroupButton });
    }

    protected getCloseButton(): Locator {
        // X close button in the modal header (has aria-label)
        return this.getModalContainer().getByRole('button', { name: translation.groupHeader.groupSettingsAriaLabel });
    }

    protected getFooterCloseButton(): Locator {
        // Close button in the security tab footer
        return this.getModalContainer().getByRole('button', { name: translation.common.close });
    }

    // ============================================================================
    // SECURITY TAB - SELECTORS
    // ============================================================================

    protected getPresetButton(preset: string): Locator {
        // Look up the label text for the preset
        const presetLabels: Record<string, string> = {
            open: translation.securitySettingsModal.presets.open.label,
            managed: translation.securitySettingsModal.presets.managed.label,
        };

        const labelText = presetLabels[preset];
        if (!labelText) {
            throw new Error(`Unknown preset: ${preset}`);
        }

        // Button's accessible name starts with the label text
        return this.getModalContainer().getByRole('button', { name: new RegExp(`^${labelText}`) });
    }

    protected getSecuritySaveButton(): Locator {
        // Save button in security tab footer, distinct from Close button
        return this.getModalContainer().getByRole('region', { name: translation.securitySettingsModal.footerActions }).getByRole('button', { name: translation.common.save });
    }

    protected getPermissionSelect(key: string): Locator {
        // Look up the label text for the permission key
        const permissionLabels: Record<string, string> = {
            expenseEditing: translation.securitySettingsModal.permissions.expenseEditing.label,
            expenseDeletion: translation.securitySettingsModal.permissions.expenseDeletion.label,
            memberInvitation: translation.securitySettingsModal.permissions.memberInvitation.label,
            memberApproval: translation.securitySettingsModal.permissions.memberApproval.label,
            settingsManagement: translation.securitySettingsModal.permissions.settingsManagement.label,
        };

        const labelText = permissionLabels[key];
        if (!labelText) {
            throw new Error(`Unknown permission key: ${key}`);
        }

        // Find the label element by its text content, then get the select inside it
        return this
            .getModalContainer()
            .locator('label')
            .filter({ hasText: labelText })
            .locator('select');
    }

    protected getPendingApproveButton(memberIdentifier: string): Locator {
        // Button has aria-label like "Approve {displayName}" where displayName can be the name or uid
        return this.getModalContainer().getByRole('button', {
            name: new RegExp(`^${translation.securitySettingsModal.pendingMembers.approve}\\s+.*${memberIdentifier}`, 'i'),
        });
    }

    protected getPendingRejectButton(memberIdentifier: string): Locator {
        // Button has aria-label like "Reject {displayName}" where displayName can be the name or uid
        return this.getModalContainer().getByRole('button', {
            name: new RegExp(`^${translation.securitySettingsModal.pendingMembers.reject}\\s+.*${memberIdentifier}`, 'i'),
        });
    }

    protected getMemberRoleSelect(memberIdentifier: string): Locator {
        // Select has aria-label like "Member roles {displayName}" where displayName can be the name or uid
        return this.getModalContainer().getByRole('combobox', {
            name: new RegExp(`${translation.securitySettingsModal.memberRoles.heading}\\s+.*${memberIdentifier}`, 'i'),
        });
    }

    // ============================================================================
    // ERROR MESSAGE SELECTORS
    // ============================================================================

    protected getValidationError(): Locator {
        // Validation error alert in the general tab form
        return this.getModalContainer().locator('form').getByRole('alert');
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
        // Success status in the general tab (within form)
        return this.getModalContainer().locator('form').getByRole('status');
    }

    protected getSecuritySuccessAlert(): Locator {
        // Success status in security tab
        return this.getModalContainer().getByRole('status', { name: translation.groupSettingsModal.securityTab.successAriaLabel });
    }

    protected getSecurityUnsavedBanner(): Locator {
        // Unsaved banner in security tab
        return this.getModalContainer().getByRole('status', { name: translation.groupSettingsModal.securityTab.unsavedChangesAriaLabel });
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
        // Delete dialog may have duplicate button text from modal footer underneath.
        // Scoped to delete dialog, .last() ensures we get the confirm button.
        return this
            .getDeleteDialog()
            .getByRole('button', { name: translation.editGroupModal.deleteConfirmDialog.confirmText })
            .last();
    }

    protected getCancelDeleteButton(): Locator {
        return this.getDeleteDialog().getByRole('button', {
            name: translation.editGroupModal.deleteConfirmDialog.cancelText,
        });
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

    async changeMemberRole(memberId: string, newRole: 'admin' | 'member' | 'viewer'): Promise<void> {
        await this.ensureSecurityTab();
        await this.getMemberRoleSelect(memberId).selectOption(newRole);
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

        const spinner = this.page.getByRole('status', { name: translation.uiComponents.loadingSpinner.loading });
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
     * Verify display name save button is enabled
     */
    async verifyDisplayNameSaveButtonEnabled(): Promise<void> {
        await expect(this.getDisplayNameSaveButton()).toBeEnabled();
    }

    /**
     * Verify display name input has expected value
     */
    async verifyDisplayNameInputValue(expectedValue: string): Promise<void> {
        await this.ensureIdentityTab();
        await expect(this.getDisplayNameInput()).toHaveValue(expectedValue);
    }

    /**
     * Verify display name input validation error is visible and contains text
     */
    async verifyDisplayNameInputErrorContainsText(expectedText: string): Promise<void> {
        await this.ensureIdentityTab();
        const validationError = this.getDisplayNameSection().getByRole('alert');
        await expect(validationError).toBeVisible();
        await expect(validationError).toContainText(expectedText);
    }

    /**
     * Verify display name input validation error is not visible
     */
    async verifyDisplayNameInputErrorNotVisible(): Promise<void> {
        await this.ensureIdentityTab();
        const validationError = this.getDisplayNameSection().getByRole('alert');
        await expect(validationError).not.toBeVisible();
    }

    /**
     * Verify display name error is visible
     */
    async verifyDisplayNameErrorVisible(): Promise<void> {
        await expect(this.getDisplayNameError()).toBeVisible();
    }

    /**
     * Verify display name error contains specific text
     */
    async verifyDisplayNameErrorContainsText(expectedText: string): Promise<void> {
        await expect(this.getDisplayNameError()).toBeVisible();
        await expect(this.getDisplayNameError()).toContainText(expectedText);
    }

    /**
     * Verify display name error is not visible (count 0)
     */
    async verifyDisplayNameErrorNotVisible(): Promise<void> {
        await expect(this.getDisplayNameError()).toHaveCount(0);
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

    // Private locator accessors - use verification methods instead
    private getDisplayNameInputLocator(): Locator {
        return this.getDisplayNameInput();
    }

    private getDisplayNameSaveButtonLocator(): Locator {
        return this.getDisplayNameSaveButton();
    }

    private getDisplayNameSuccessLocator(): Locator {
        return this.getDisplayNameSuccess();
    }

    private getDisplayNameSectionLocator(): Locator {
        return this.getDisplayNameSection();
    }

    private getDisplayNameErrorLocator(): Locator {
        return this.getDisplayNameError();
    }

    private getPendingApproveButtonLocator(memberId: string): Locator {
        return this.getPendingApproveButton(memberId);
    }

    private getPendingRejectButtonLocator(memberId: string): Locator {
        return this.getPendingRejectButton(memberId);
    }

    private getModalContainerLocator(): Locator {
        return this.getModalContainer();
    }

    /**
     * Verify "No pending requests" message is visible after all pending members are processed
     */
    async verifyNoPendingRequestsMessageVisible(): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getModalContainer().getByText(translation.securitySettingsModal.pendingMembers.empty)).toBeVisible();
    }

    /**
     * Verify pending member text is visible in the modal
     */
    async verifyPendingMemberTextVisible(memberName: string): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getModalContainer().getByText(memberName)).toBeVisible();
    }

    /**
     * Verify pending member text is not visible in the modal
     */
    async verifyPendingMemberTextNotVisible(memberName: string): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getModalContainer().getByText(memberName)).toHaveCount(0);
    }

    // ============================================================================
    // MEMBER ROLE VERIFICATION HELPERS
    // ============================================================================

    /**
     * Verify member role select dropdown is disabled (for group creator)
     */
    async verifyMemberRoleSelectDisabled(memberId: string): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getMemberRoleSelect(memberId)).toBeDisabled();
    }

    /**
     * Verify member role select dropdown is enabled
     */
    async verifyMemberRoleSelectEnabled(memberId: string): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getMemberRoleSelect(memberId)).toBeEnabled();
    }

    /**
     * Verify member role select has expected value
     */
    async verifyMemberRoleValue(memberId: string, expectedRole: 'admin' | 'member' | 'viewer'): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getMemberRoleSelect(memberId)).toHaveValue(expectedRole);
    }

    /**
     * Get member role select locator for direct assertions
     */
    getMemberRoleSelectLocator(memberId: string): Locator {
        return this.getMemberRoleSelect(memberId);
    }

    // ============================================================================
    // DELETE DIALOG VERIFICATION HELPERS
    // ============================================================================

    /**
     * Verify delete confirmation dialog is visible
     */
    async verifyDeleteDialogVisible(): Promise<void> {
        await expect(this.getDeleteDialog()).toBeVisible();
    }

    /**
     * Verify delete confirmation dialog is not visible
     */
    async verifyDeleteDialogNotVisible(): Promise<void> {
        await expect(this.getDeleteDialog()).not.toBeVisible();
    }

    /**
     * Verify confirm delete button is disabled
     */
    async verifyConfirmDeleteButtonDisabled(): Promise<void> {
        await expect(this.getConfirmDeleteButton()).toBeDisabled();
    }

    /**
     * Verify confirm delete button is enabled
     */
    async verifyConfirmDeleteButtonEnabled(): Promise<void> {
        await expect(this.getConfirmDeleteButton()).toBeEnabled();
    }

    /**
     * Click cancel in delete dialog to return to settings modal
     */
    async cancelDelete(): Promise<void> {
        await this.getCancelDeleteButton().click();
        await expect(this.getDeleteDialog()).not.toBeVisible({ timeout: 2000 });
    }

    /**
     * Get validation error locator for direct assertions
     */
    getValidationErrorLocator(): Locator {
        return this.getValidationError();
    }

    /**
     * Get general success alert locator for direct assertions
     */
    getGeneralSuccessAlertLocator(): Locator {
        return this.getGeneralSuccessAlert();
    }

    // ============================================================================
    // CUSTOM PERMISSIONS VERIFICATION HELPERS
    // ============================================================================

    /**
     * Change a specific permission in the custom permissions section
     */
    async changePermission(key: string, value: string): Promise<void> {
        await this.ensureSecurityTab();
        await this.getPermissionSelect(key).selectOption(value);
    }

    /**
     * Verify a specific permission has the expected value
     */
    async verifyPermissionValue(key: string, expectedValue: string): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getPermissionSelect(key)).toHaveValue(expectedValue);
    }

    /**
     * Verify a preset button is selected (has aria-pressed="true")
     */
    async verifyPresetSelected(preset: string): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getPresetButton(preset)).toHaveAttribute('aria-pressed', 'true');
    }

    /**
     * Verify a preset button is not selected
     */
    async verifyPresetNotSelected(preset: string): Promise<void> {
        await this.ensureSecurityTab();
        await expect(this.getPresetButton(preset)).toHaveAttribute('aria-pressed', 'false');
    }

    /**
     * Verify no managed preset is selected (custom mode)
     */
    async verifyCustomPresetActive(): Promise<void> {
        await this.ensureSecurityTab();
        // Neither 'open' nor 'managed' should be selected when in custom mode
        await expect(this.getPresetButton('open')).toHaveAttribute('aria-pressed', 'false');
        await expect(this.getPresetButton('managed')).toHaveAttribute('aria-pressed', 'false');
    }

    /**
     * Get permission select locator for direct assertions
     */
    getPermissionSelectLocator(key: string): Locator {
        return this.getPermissionSelect(key);
    }

    // ============================================================================
    // TAB VISIBILITY VERIFICATION HELPERS
    // ============================================================================

    /**
     * Verify a specific tab is visible
     */
    async verifyTabVisible(tab: GroupSettingsTab): Promise<void> {
        await expect(this.getTabButton(tab)).toBeVisible();
    }

    /**
     * Verify a specific tab is not visible
     */
    async verifyTabNotVisible(tab: GroupSettingsTab): Promise<void> {
        await expect(this.getTabButton(tab)).not.toBeVisible();
    }

    /**
     * Click on a specific tab
     */
    async clickTab(tab: GroupSettingsTab): Promise<void> {
        await this.getTabButton(tab).click();
    }

    /**
     * Get the list of visible tabs
     */
    async getVisibleTabs(): Promise<GroupSettingsTab[]> {
        const tabs: GroupSettingsTab[] = [];
        if (await this.hasTab('identity')) tabs.push('identity');
        if (await this.hasTab('general')) tabs.push('general');
        if (await this.hasTab('security')) tabs.push('security');
        return tabs;
    }

    /**
     * Verify the group name input is visible (general tab content)
     */
    async verifyGroupNameInputVisible(): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getGroupNameInput()).toBeVisible();
    }

    /**
     * Verify the group name input has the expected value
     */
    async verifyGroupNameValue(expectedValue: string): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getGroupNameInput()).toHaveValue(expectedValue);
    }

    /**
     * Get group name input locator for direct assertions
     * @deprecated Use verifyGroupNameValue() or other verification methods instead
     */
    getGroupNameInputLocator(): Locator {
        return this.getGroupNameInput();
    }

    // ============================================================================
    // CURRENCY SETTINGS HELPERS
    // ============================================================================

    protected getCurrencyRestrictionsToggle(): Locator {
        return this.getModalContainer().getByRole('switch', { name: translation.groupSettings.currencySettings.enableToggle });
    }

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

    protected getCurrencySettingsSaveButton(): Locator {
        // Currency settings now use the unified Save button for the entire General tab
        return this.getSaveButton();
    }

    protected getCurrencySettingsSuccessAlert(): Locator {
        // Currency settings now use the unified success message for the entire General tab
        return this.getGeneralSuccessAlert();
    }

    /**
     * Toggle currency restrictions on or off
     */
    async toggleCurrencyRestrictions(): Promise<void> {
        await this.ensureGeneralTab();
        // Find and click the label text which is linked to the switch via htmlFor
        const labelText = this.getModalContainer().getByText(translation.groupSettings.currencySettings.enableToggle, { exact: true });
        await labelText.scrollIntoViewIfNeeded();
        await labelText.click();
    }

    /**
     * Add a currency to permitted list
     */
    async addPermittedCurrency(code: string): Promise<void> {
        await this.ensureGeneralTab();
        await this.getAddCurrencyButton().click();
        await this.getCurrencySearchInput().fill(code);
        await this.getAddCurrencyOption(code).click();
    }

    /**
     * Remove a currency from permitted list
     */
    async removePermittedCurrency(code: string): Promise<void> {
        await this.ensureGeneralTab();
        await this.getRemoveCurrencyButton(code).click();
    }

    /**
     * Set the default currency
     */
    async setDefaultCurrency(code: string): Promise<void> {
        await this.ensureGeneralTab();
        await this.getDefaultCurrencySelect().selectOption(code);
    }

    /**
     * Save currency settings
     */
    async saveCurrencySettings(): Promise<void> {
        await this.ensureGeneralTab();
        const saveButton = this.getCurrencySettingsSaveButton();
        await expect(saveButton).toBeEnabled();
        await this.clickButton(saveButton, { buttonName: translation.common.save });
    }

    /**
     * Verify currency restrictions toggle is visible
     */
    async verifyCurrencyRestrictionsToggleVisible(): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getCurrencyRestrictionsToggle()).toBeVisible();
    }

    /**
     * Verify currency restrictions toggle is not visible (non-admin user)
     */
    async verifyCurrencyRestrictionsToggleNotVisible(): Promise<void> {
        await expect(this.getCurrencyRestrictionsToggle()).not.toBeVisible();
    }

    /**
     * Verify add currency button is visible (restrictions enabled)
     */
    async verifyAddCurrencyButtonVisible(): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getAddCurrencyButton()).toBeVisible();
    }

    /**
     * Verify a specific currency chip is visible in permitted list
     */
    async verifyPermittedCurrencyVisible(code: string): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getRemoveCurrencyButton(code)).toBeVisible();
    }

    /**
     * Verify a specific currency chip is not visible in permitted list
     */
    async verifyPermittedCurrencyNotVisible(code: string): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getRemoveCurrencyButton(code)).not.toBeVisible();
    }

    /**
     * Verify currency settings success message is visible
     */
    async verifyCurrencySettingsSuccessVisible(): Promise<void> {
        await expect(this.getCurrencySettingsSuccessAlert()).toBeVisible();
    }

    /**
     * Verify default currency select has expected value
     */
    async verifyDefaultCurrencyValue(code: string): Promise<void> {
        await this.ensureGeneralTab();
        await expect(this.getDefaultCurrencySelect()).toHaveValue(code);
    }

    // ============================================================================
    // GROUP LOCKING HELPERS
    // ============================================================================

    /**
     * Get the lock toggle when group is UNLOCKED (shows "Lock group" label).
     * Use this when you expect the group to be unlocked.
     */
    protected getUnlockedGroupToggle(): Locator {
        return this.getModalContainer().getByRole('switch', { name: translation.group.locked.toggle });
    }

    /**
     * Get the lock toggle when group is LOCKED (shows "Unlock group" label).
     * Use this when you expect the group to be locked.
     */
    protected getLockedGroupToggle(): Locator {
        return this.getModalContainer().getByRole('switch', { name: translation.group.locked.unlockToggle });
    }

    /**
     * Get the visible switch track label for the group lock toggle.
     * The Switch component has a hidden sr-only input and a visible label.
     * We need to click the label (not the sr-only input) because sr-only
     * elements are positioned off-screen and fail viewport checks.
     */
    protected getGroupLockToggle(): Locator {
        // .first(): Multiple labels for same input; first is the visible switch track
        return this.getModalContainer().locator('label[for="group-lock-toggle"]').first();
    }

    protected getGroupLockSectionHeading(): Locator {
        return this.getModalContainer().getByRole('heading', { name: translation.group.locked.sectionTitle });
    }

    protected getGroupLockSection(): Locator {
        // Scope-first: find the section that contains the lock section heading
        return this.getModalContainer().locator('section').filter({
            has: this.page.getByRole('heading', { name: translation.group.locked.sectionTitle }),
        });
    }

    protected getGroupLockSuccessAlert(): Locator {
        // Success message now uses the unified form success alert
        return this.getGeneralSuccessAlert();
    }

    /**
     * Lock the group. Expects the group to be currently unlocked.
     * Toggles the lock switch and saves the change.
     *
     * IMPORTANT: We click the visible label (switch track), not the sr-only input,
     * because sr-only elements are positioned off-screen and fail viewport checks.
     */
    async lockGroup(): Promise<void> {
        const label = this.getGroupLockToggle();

        // Use polling to handle race conditions - tab may reset after ensureGeneralTab returns
        await expect(async () => {
            await this.ensureGeneralTab();
            const toggle = this.getUnlockedGroupToggle();
            // Verify group is currently unlocked and toggle is visible
            await expect(toggle).toBeVisible({ timeout: 500 });
            await expect(toggle).not.toBeChecked({ timeout: 500 });
        }).toPass({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION, intervals: [100, 200, 500] });

        // Click the visible label to toggle
        await label.scrollIntoViewIfNeeded();
        await label.click();
        // Wait for the state change - now we expect the "Unlock" toggle to be checked
        await expect(this.getLockedGroupToggle()).toBeChecked();
        // Save the change (unified save button)
        const saveButton = this.getSaveButton();
        await this.clickButton(saveButton, { buttonName: translation.common.save });
        // Wait for success
        await expect(this.getGeneralSuccessAlert()).toBeVisible();
    }

    /**
     * Unlock the group. Expects the group to be currently locked.
     * Toggles the lock switch and saves the change.
     *
     * IMPORTANT: We click the visible label (switch track), not the sr-only input,
     * because sr-only elements are positioned off-screen and fail viewport checks.
     */
    async unlockGroup(): Promise<void> {
        const label = this.getGroupLockToggle();

        // Use polling to handle race conditions - tab may reset after ensureGeneralTab returns
        await expect(async () => {
            await this.ensureGeneralTab();
            const toggle = this.getLockedGroupToggle();
            // Verify group is currently locked and toggle is visible
            await expect(toggle).toBeVisible({ timeout: 500 });
            await expect(toggle).toBeChecked({ timeout: 500 });
        }).toPass({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION, intervals: [100, 200, 500] });

        // Click the visible label to toggle
        await label.scrollIntoViewIfNeeded();
        await label.click();
        // Wait for the state change - now we expect the "Lock" toggle to be unchecked
        await expect(this.getUnlockedGroupToggle()).not.toBeChecked();
        // Save the change (unified save button)
        const saveButton = this.getSaveButton();
        await this.clickButton(saveButton, { buttonName: translation.common.save });
        // Wait for success
        await expect(this.getGeneralSuccessAlert()).toBeVisible();
    }

    /**
     * Verify group lock toggle is visible (admin only)
     */
    async verifyGroupLockToggleVisible(): Promise<void> {
        // Use polling to handle race conditions - tab may reset after ensureGeneralTab returns
        await expect(async () => {
            await this.ensureGeneralTab();
            await expect(this.getGroupLockToggle()).toBeVisible({ timeout: 500 });
        }).toPass({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION, intervals: [100, 200, 500] });
    }

    /**
     * Verify group lock toggle is not visible (non-admin)
     */
    async verifyGroupLockToggleNotVisible(): Promise<void> {
        await expect(this.getGroupLockToggle()).not.toBeVisible();
    }

    /**
     * Verify group is locked (shows "Unlock group" toggle which is checked)
     */
    async verifyGroupLocked(): Promise<void> {
        // Use polling to handle race conditions - tab may reset after ensureGeneralTab returns
        await expect(async () => {
            await this.ensureGeneralTab();
            await expect(this.getLockedGroupToggle()).toBeChecked({ timeout: 500 });
        }).toPass({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION, intervals: [100, 200, 500] });
    }

    /**
     * Verify group is unlocked (shows "Lock group" toggle which is not checked)
     */
    async verifyGroupUnlocked(): Promise<void> {
        // Use polling to handle race conditions - tab may reset after ensureGeneralTab returns
        await expect(async () => {
            await this.ensureGeneralTab();
            await expect(this.getUnlockedGroupToggle()).not.toBeChecked({ timeout: 500 });
        }).toPass({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION, intervals: [100, 200, 500] });
    }

    /**
     * Verify group lock success message is visible
     */
    async verifyGroupLockSuccessVisible(): Promise<void> {
        await expect(this.getGroupLockSuccessAlert()).toBeVisible();
    }
}
