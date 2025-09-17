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

    async confirmRemoveMember(): Promise<void> {
        await expect(this.confirmButton).toBeVisible({ timeout: 2000 });
        await this.clickButton(this.confirmButton, { buttonName: 'Confirm Remove' });
    }

}
