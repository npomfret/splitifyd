import { expect, Locator, Page } from '@playwright/test';
import { LeaveGroupDialogPage as BaseLeaveGroupDialogPage } from '@splitifyd/test-support';
import { DashboardPage } from './dashboard.page';

/**
 * E2E-specific extension of LeaveGroupDialogPage from test-support
 * Adds e2e-specific navigation handling and balance warning detection
 */
export class LeaveGroupModalPage extends BaseLeaveGroupDialogPage {
    constructor(page: Page) {
        super(page);
    }

    /**
     * Confirm leaving group and navigate to dashboard
     * E2E-specific: Returns DashboardPage for fluent navigation
     * Validates no outstanding balance before leaving
     */
    async confirmLeaveGroup(): Promise<DashboardPage> {
        await expect(this.getConfirmButton()).toBeVisible({ timeout: 2000 });

        // Get the actual button text to determine the state
        const buttonText = await this.getConfirmButtonText();

        if (buttonText?.includes('Understood')) {
            // Button shows "Understood" - there's an outstanding balance
            throw new Error('Cannot leave group with outstanding balance. Use expectLeaveBlockedAndCancel() instead.');
        }

        // Button text should be "Leave Group" - proceed with leaving
        await this.clickConfirm();

        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.waitForDashboard();
        await expect(this.page).toHaveURL(/\/dashboard/);

        return dashboardPage;
    }

    /**
     * Cancel leaving the group
     * E2E-specific: Alias for clickCancel with different naming
     */
    async cancelLeaveGroup(): Promise<void> {
        await this.clickCancel();
    }

    /**
     * Verify outstanding balance error message appears
     * E2E-specific: Extended timeout for balance calculation
     */
    async verifyLeaveErrorMessage(): Promise<void> {
        const errorMessage = this.getBalanceWarningMessage();
        try {
            await expect(errorMessage).toBeVisible({ timeout: 10000 });
        } catch (e) {
            throw new Error(
                'The error message for leaving with an outstanding balance did not appear within 10 seconds',
            );
        }
    }

    // ============================================================================
    // COMPATIBILITY METHODS - For existing e2e tests
    // ============================================================================

    /**
     * Get dialog container (alternate naming)
     * E2E compatibility: Alias for getDialogContainer
     */
    private get dialog(): Locator {
        return this.getDialogContainer();
    }

    /**
     * Get confirm button (alternate naming)
     * E2E compatibility: Alias for getConfirmButton
     */
    private get confirmButton(): Locator {
        return this.getConfirmButton();
    }

    /**
     * Get cancel button (alternate naming)
     * E2E compatibility: Alias for getCancelButton
     */
    private get cancelButton(): Locator {
        return this.getCancelButton();
    }

    /**
     * Wait for dialog to be visible
     * E2E compatibility: Alias for waitForDialogToOpen
     */
    async waitForDialogVisible(): Promise<void> {
        await this.waitForDialogToOpen();
    }
}
