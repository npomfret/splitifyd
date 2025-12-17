import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { DashboardPage } from './DashboardPage';

const translation = translationEn;

/**
 * Leave Group Dialog Page Object Model for Playwright tests
 * Handles leave group confirmation with outstanding balance warnings
 * Reusable across unit tests and e2e tests
 */
export class LeaveGroupDialogPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER SELECTORS
    // ============================================================================

    /**
     * Main dialog container - Modal component has role="dialog"
     */
    protected getDialogContainer(): Locator {
        return this.page.getByRole('dialog');
    }

    /**
     * Inner confirmation dialog - Surface inside the modal
     * Using the dialog role as the scope since it's the primary container
     */
    protected getConfirmationDialog(): Locator {
        return this.getDialogContainer();
    }

    /**
     * Dialog backdrop
     */
    protected getDialogBackdrop(): Locator {
        return this.getDialogContainer();
    }

    // ============================================================================
    // ELEMENT SELECTORS
    // ============================================================================

    /**
     * Dialog title
     */
    protected getDialogTitle(): Locator {
        return this.getConfirmationDialog().getByRole('heading', { name: translation.membersList.leaveGroupDialog.title });
    }

    /**
     * Dialog message - uses the describedBy element from Modal
     */
    protected getDialogMessage(): Locator {
        return this.getConfirmationDialog().locator('#confirm-dialog-description');
    }

    /**
     * Outstanding balance warning message - identified by text content
     */
    protected getBalanceWarningMessage(): Locator {
        return this.getConfirmationDialog().locator('#confirm-dialog-description').filter({ hasText: /outstanding balance/i });
    }

    /**
     * Confirm button - uses accessible name from ConfirmDialog
     * Button text is "Leave Group" (normal) or "Understood" (when has balance)
     */
    protected getConfirmButton(): Locator {
        const confirmText = translation.membersList.leaveGroupDialog.confirmText;
        const understoodText = translation.common.understood;
        return this.getConfirmationDialog().getByRole('button', { name: new RegExp(`${confirmText}|${understoodText}`, 'i') });
    }

    /**
     * Cancel button - uses accessible name from ConfirmDialog
     */
    protected getCancelButton(): Locator {
        return this.getConfirmationDialog().getByRole('button', { name: translation.membersList.leaveGroupDialog.cancelText });
    }

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Check if showing outstanding balance warning
     */
    async hasOutstandingBalanceWarning(): Promise<boolean> {
        const message = await this.getDialogMessage().textContent();
        return message?.includes('outstanding balance') || message?.includes('settle') || false;
    }

    /**
     * Get dialog message text
     */
    async getMessageText(): Promise<string> {
        return (await this.getDialogMessage().textContent()) || '';
    }

    /**
     * Get confirm button text
     */
    async getConfirmButtonText(): Promise<string> {
        return (await this.getConfirmButton().textContent()) || '';
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Wait for dialog to open
     */
    async waitForDialogToOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getDialogContainer()).toBeVisible({ timeout });
        await expect(this.getConfirmationDialog()).toBeVisible({ timeout });
        await expect(this.getConfirmButton()).toBeVisible({ timeout });
        await expect(this.getCancelButton()).toBeVisible({ timeout });
    }

    /**
     * Click confirm button
     */
    async clickConfirm(): Promise<void> {
        const button = this.getConfirmButton();
        await this.clickButton(button, { buttonName: translation.membersList.leaveGroupDialog.confirmText });
    }

    /**
     * Click cancel button
     */
    async clickCancel(): Promise<void> {
        const button = this.getCancelButton();
        await this.clickButton(button, { buttonName: 'Cancel' });
    }

    /**
     * Close dialog by pressing Escape
     */
    async pressEscapeToClose(): Promise<void> {
        await super.pressEscapeToClose(this.getDialogContainer());
    }

    // ============================================================================
    // WORKFLOW METHODS
    // ============================================================================

    /**
     * Confirm leaving the group and return a dashboard page object.
     * Provides optional factory to construct custom dashboard implementations.
     */
    async confirmLeaveGroup<T = DashboardPage>(createDashboardPage?: (page: Page) => T): Promise<T> {
        await expect(this.getConfirmButton()).toBeVisible({ timeout: 2000 });

        const buttonText = await this.getConfirmButtonText();
        if (buttonText?.includes('Understood')) {
            throw new Error('Cannot leave group with outstanding balance. Use attemptLeaveWithBalance() instead.');
        }

        await this.clickConfirm();
        await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 10000 });

        const dashboardPage = createDashboardPage
            ? createDashboardPage(this.page)
            : ((new DashboardPage(this.page)) as unknown as T);

        if (dashboardPage) {
            const guards = dashboardPage as unknown as {
                waitForDashboard?: () => Promise<void>;
                verifyDashboardPageLoaded?: () => Promise<void>;
            };

            if (typeof guards.waitForDashboard === 'function') {
                await guards.waitForDashboard();
            } else if (typeof guards.verifyDashboardPageLoaded === 'function') {
                await guards.verifyDashboardPageLoaded();
            }
        }

        return dashboardPage;
    }

    /**
     * Alias for cancel action with legacy naming.
     */
    async cancelLeaveGroup(): Promise<void> {
        await this.clickCancel();
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify dialog shows outstanding balance warning
     */
    async verifyOutstandingBalanceWarning(): Promise<void> {
        await expect(this.getDialogTitle()).toBeVisible();
        await expect(this.getDialogMessage()).toBeVisible();

        // Message should mention outstanding balance
        const message = await this.getMessageText();
        expect(message.toLowerCase()).toMatch(/outstanding balance|settle|owe|owed/);

        // Confirm button should show "Understood" or similar acknowledgment
        const confirmText = await this.getConfirmButtonText();
        expect(confirmText.toLowerCase()).toMatch(/understood|ok/);
    }

    /**
     * Wait for the outstanding balance error message to appear.
     */
    async verifyLeaveErrorMessage(timeout: number = 10000): Promise<void> {
        await expect(this.getBalanceWarningMessage()).toBeVisible({ timeout });
    }
}
