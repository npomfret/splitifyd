import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class RemoveMemberModalPage extends BasePage {
    private dialog: Locator;
    private confirmButton: Locator;
    private cancelButton: Locator;

    constructor(page: Page) {
        super(page);
        this.dialog = this.page.getByTestId('remove-member-dialog');
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

    async confirmRemoveMember(): Promise<void> {
        await expect(this.confirmButton).toBeVisible({ timeout: 2000 });
        await this.clickButton(this.confirmButton, { buttonName: 'Confirm Remove' });
    }

    async cancelRemoveMember(): Promise<void> {
        await this.clickButton(this.cancelButton, { buttonName: 'Cancel Remove' });
    }

    async waitForOutstandingBalanceError(): Promise<void> {
        // Check for error message indicating member has outstanding balance
        const errorMessage = this.dialog.getByText(/outstanding balance|settle up before removing/i);
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
    }

    async verifyRemoveErrorMessage(): Promise<void> {
        const errorMessage = this.dialog.getByTestId('balance-error-message');
        try {
            await expect(errorMessage).toBeVisible({ timeout: 10000 });
        } catch (e) {
            throw new Error('The error message for removing a member with an outstanding balance did not appear within 10 seconds');
        }
    }
}