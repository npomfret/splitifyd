import { expect, Locator, Page } from '@playwright/test';

export class SecuritySettingsModalPage {
    constructor(private readonly page: Page) {}

    getModal(): Locator {
        return this.page.locator('[data-testid="close-security-modal-button"]').locator('..').locator('..');
    }

    async waitForOpen(): Promise<void> {
        await expect(this.page.getByTestId('close-security-modal-button')).toBeVisible();
    }

    async close(): Promise<void> {
        await this.page.getByTestId('security-close-button').click();
    }

    getPresetButton(preset: string): Locator {
        return this.page.getByTestId(`preset-button-${preset}`);
    }

    async selectPreset(preset: string): Promise<void> {
        await this.getPresetButton(preset).click();
    }

    async savePermissions(): Promise<void> {
        await this.page.getByTestId('save-permissions-button').click();
    }

    getPermissionSelect(key: string): Locator {
        return this.page.getByTestId(`permission-select-${key}`);
    }

    getPendingApproveButton(memberId: string): Locator {
        return this.page.getByTestId(`pending-approve-${memberId}`);
    }

    getPendingRejectButton(memberId: string): Locator {
        return this.page.getByTestId(`pending-reject-${memberId}`);
    }
}
