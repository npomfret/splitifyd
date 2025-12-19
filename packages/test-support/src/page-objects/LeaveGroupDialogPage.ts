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
 *
 * ## Selector Strategy
 * - Single dialog invariant: only one confirmation dialog open at a time
 * - All selectors scoped to `getDialogContainer()` for clarity
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
     * Single dialog invariant: only one dialog open at a time
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
        return this.getConfirmationDialog().locator('#confirm-dialog-description').filter({
            hasText: translation.membersList.leaveGroupDialog.messageWithBalance,
        });
    }

    /**
     * Leave button - used when user can leave the group (no outstanding balance)
     */
    protected getLeaveButton(): Locator {
        return this.getConfirmationDialog().getByRole('button', { name: translation.membersList.leaveGroupDialog.confirmText });
    }

    /**
     * Understood button - used when user cannot leave due to outstanding balance
     */
    protected getUnderstoodButton(): Locator {
        return this.getConfirmationDialog().getByRole('button', { name: translation.common.understood });
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

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Wait for leave dialog to open (when user can leave)
     */
    async waitForLeaveDialogToOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getDialogContainer()).toBeVisible({ timeout });
        await expect(this.getConfirmationDialog()).toBeVisible({ timeout });
        await expect(this.getLeaveButton()).toBeVisible({ timeout });
        await expect(this.getCancelButton()).toBeVisible({ timeout });
    }

    /**
     * Wait for balance warning dialog to open (when user has outstanding balance)
     */
    async waitForBalanceWarningDialogToOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getDialogContainer()).toBeVisible({ timeout });
        await expect(this.getConfirmationDialog()).toBeVisible({ timeout });
        await expect(this.getUnderstoodButton()).toBeVisible({ timeout });
        await expect(this.getCancelButton()).toBeVisible({ timeout });
    }

    /**
     * Click leave button
     */
    async clickLeave(): Promise<void> {
        await this.clickButton(this.getLeaveButton(), { buttonName: translation.membersList.leaveGroupDialog.confirmText });
    }

    /**
     * Click understood button (when balance warning is shown)
     */
    async clickUnderstood(): Promise<void> {
        await this.clickButton(this.getUnderstoodButton(), { buttonName: translation.common.understood });
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
     * Only use when user CAN leave (no outstanding balance).
     * Provides optional factory to construct custom dashboard implementations.
     */
    async confirmLeaveGroup<T = DashboardPage>(createDashboardPage?: (page: Page) => T): Promise<T> {
        await expect(this.getLeaveButton()).toBeVisible({ timeout: 2000 });

        await this.clickLeave();
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

        // Should show "Understood" button instead of "Leave" button
        await expect(this.getUnderstoodButton()).toBeVisible();
    }

    /**
     * Wait for the outstanding balance error message to appear.
     */
    async verifyLeaveErrorMessage(timeout: number = 10000): Promise<void> {
        await expect(this.getBalanceWarningMessage()).toBeVisible({ timeout });
    }
}
