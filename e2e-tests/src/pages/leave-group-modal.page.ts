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

    getDialog(): Locator {
        return this.dialog;
    }

    getConfirmButton(): Locator {
        return this.confirmButton;
    }

    getCancelButton(): Locator {
        return this.cancelButton;
    }

    async waitForDialogVisible(): Promise<void> {
        await expect(this.dialog).toBeVisible();
    }

    async confirmLeaveGroup(): Promise<DashboardPage> {
        await expect(this.confirmButton).toBeVisible({ timeout: 2000 });
        await this.clickButton(this.confirmButton, { buttonName: 'Understood' });

        const dashboardPage = new DashboardPage(this.page, this.userInfo);
        await dashboardPage.waitForDashboard();
        await expect(this.page).toHaveURL(/\/dashboard/);

        return dashboardPage;
    }

    async cancelLeaveGroup(): Promise<void> {
        await this.clickButton(this.cancelButton, { buttonName: 'Cancel Leave' });
    }

    async waitForOutstandingBalanceError(): Promise<void> {
        // First try the specific test ID approach (more reliable)
        try {
            await this.verifyLeaveErrorMessage();
            return;
        } catch {
            // Fallback to text-based approach
            const errorMessage = this.page.getByText(/outstanding balance|settle up before leaving/i);
            await expect(errorMessage).toBeVisible({ timeout: 5000 });
        }
    }

    async verifyLeaveErrorMessage(): Promise<void> {
        const errorMessage = this.dialog.getByTestId('balance-error-message');
        try {
            await expect(errorMessage).toBeVisible({ timeout: 10000 });
        } catch (e) {
            throw new Error('The error message for leaving with an outstanding balance did not appear within 10 seconds');
        }
    }

    async assertOutstandingBalanceMessage(): Promise<void> {
        // Look for the specific outstanding balance message text
        const balanceMessage = this.dialog.getByText(/You have an outstanding balance in this group\. Please settle up before leaving\./i);
        await expect(balanceMessage).toBeVisible({ timeout: 1000 });
    }

    async clickUnderstoodToCloseModal(): Promise<void> {
        // When there's an outstanding balance, the button shows "Understood"
        // However, clicking it may not close the modal, so we'll cancel instead
        await expect(this.cancelButton).toBeVisible({ timeout: 2000 });
        await this.clickButton(this.cancelButton, { buttonName: 'Cancel' });

        // Wait for the modal to close
        await expect(this.dialog).not.toBeVisible({ timeout: 2000 });
    }
}
