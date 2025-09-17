import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class RemoveMemberModalPage extends BasePage {
    private dialog: Locator;
    private confirmButton: Locator;

    constructor(page: Page) {
        super(page);
        this.dialog = this.page.getByTestId('remove-member-dialog');
        this.confirmButton = this.dialog.getByTestId('confirm-button');
    }

    async confirmRemoveMember(): Promise<void> {
        await expect(this.confirmButton).toBeVisible({ timeout: 2000 });
        await this.clickButton(this.confirmButton, { buttonName: 'Confirm Remove' });
    }

    async waitForDialogVisible(): Promise<void> {
        await expect(this.dialog).toBeVisible();
    }

}
