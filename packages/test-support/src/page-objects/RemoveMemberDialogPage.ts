import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';

/**
 * Remove Member confirmation dialog used in group management flows.
 * Encapsulates the confirmation button and dialog visibility helpers.
 */
export class RemoveMemberDialogPage extends BasePage {
    private dialog: Locator;
    private confirmButton: Locator;

    constructor(page: Page) {
        super(page);
        this.dialog = this.page.getByTestId('remove-member-dialog');
        this.confirmButton = this.dialog.getByTestId('confirm-button');
    }

    /**
     * Wait for the dialog to be visible and ready for interaction.
     */
    async waitForDialogVisible(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.dialog).toBeVisible({ timeout });
    }

    /**
     * Confirm removal by clicking the confirm button.
     */
    async confirmRemoveMember(): Promise<void> {
        await expect(this.confirmButton).toBeVisible({ timeout: 2000 });
        await this.clickButton(this.confirmButton, { buttonName: 'Confirm Remove' });
    }

}
