import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { DashboardPage } from './dashboard.page';

export class LeaveGroupModalPage extends BasePage {
    private dialog: Locator;
    private confirmButton: Locator;
    private cancelButton: Locator;

    constructor(page: Page) {
        super(page);
        this.dialog = this.page.getByTestId('leave-group-dialog');
        this.confirmButton = this.dialog.getByTestId('confirm-button');
        this.cancelButton = this.dialog.getByTestId('cancel-button');
    }

    async waitForDialogVisible(): Promise<void> {
        await expect(this.dialog).toBeVisible();
    }

    async confirmLeaveGroup(): Promise<DashboardPage> {
        await expect(this.confirmButton).toBeVisible({ timeout: 2000 });

        // Get the actual button text to determine the state
        const buttonText = await this.confirmButton.textContent();

        if (buttonText?.includes('Understood')) {
            // Button shows "Understood" - there's an outstanding balance
            throw new Error('Cannot leave group with outstanding balance. Use expectLeaveBlockedAndCancel() instead.');
        }

        // Button text should be "Leave Group" - proceed with leaving
        await this.clickButton(this.confirmButton, { buttonName: 'Leave Group' });

        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.waitForDashboard();
        await expect(this.page).toHaveURL(/\/dashboard/);

        return dashboardPage;
    }

    async cancelLeaveGroup(): Promise<void> {
        await this.clickButton(this.cancelButton, { buttonName: 'Cancel Leave' });
    }

    async verifyLeaveErrorMessage(): Promise<void> {
        const errorMessage = this.dialog.getByTestId('balance-error-message');
        try {
            await expect(errorMessage).toBeVisible({ timeout: 10000 });
        } catch (e) {
            throw new Error('The error message for leaving with an outstanding balance did not appear within 10 seconds');
        }
    }
}
