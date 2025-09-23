import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { PooledTestUser } from '@splitifyd/shared';
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class ShareGroupModalPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }

    // Element accessors
    getModalDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    getShareLinkInput(): Locator {
        return this.getModalDialog().locator('input[type="text"]');
    }

    getCopyButton(): Locator {
        return this.getModalDialog().getByTestId('copy-link-button');
    }

    getCloseButton(): Locator {
        return this.getModalDialog().getByTestId('close-share-modal-button');
    }

    getLoadingSpinner(): Locator {
        return this.getModalDialog().locator('.animate-spin');
    }

    getErrorMessage(): Locator {
        return this.getModalDialog().getByTestId('share-group-error-message');
    }

    getQRCode(): Locator {
        return this.getModalDialog().locator('canvas'); // QR code is rendered as canvas
    }

    // Modal state methods
    async isOpen(): Promise<boolean> {
        return await this.getModalDialog().isVisible();
    }

    async waitForModalVisible(): Promise<void> {
        await expect(this.getModalDialog()).toBeVisible({ timeout: 5000 });

        // Wait for modal title to ensure it's fully rendered
        await expect(this.page.getByRole('heading', { name: translationEn.shareGroupModal.title })).toBeVisible();
    }

    // Action methods
    async waitForShareLinkLoaded(): Promise<void> {
        // Wait for loading spinner to disappear if present
        const loadingSpinner = this.getLoadingSpinner();
        if ((await loadingSpinner.count()) > 0) {
            await expect(loadingSpinner).not.toBeVisible({ timeout: 5000 });
        }

        // Wait for share link input to be visible and have a value
        const shareLinkInput = this.getShareLinkInput();
        await expect(shareLinkInput).toBeVisible({ timeout: 5000 });

        // Ensure the input has a valid share link value
        await expect(async () => {
            const shareLink = await shareLinkInput.inputValue();
            if (!shareLink || !shareLink.includes('/join?')) {
                throw new Error(`Invalid share link: ${shareLink}`);
            }
        }).toPass({ timeout: 5000 });
    }

    async getShareLink(): Promise<string> {
        await this.waitForShareLinkLoaded();

        const shareLinkInput = this.getShareLinkInput();
        const shareLink = await shareLinkInput.inputValue();

        if (!shareLink || !shareLink.includes('/join?')) {
            throw new Error(`Invalid share link received: ${shareLink}`);
        }

        return shareLink;
    }

    async copyShareLink(): Promise<void> {
        await this.waitForShareLinkLoaded();

        const copyButton = this.getCopyButton();
        await expect(copyButton).toBeVisible();
        await this.clickButton(copyButton, { buttonName: 'Copy Link' });

        // Wait for copy confirmation (button icon changes)
        await expect(copyButton.locator('svg').first()).toBeVisible();
    }

    async closeModal(): Promise<void> {
        const closeButton = this.getCloseButton();
        if (await closeButton.isVisible()) {
            await this.clickButton(closeButton, { buttonName: 'Close' });
        } else {
            // Click outside modal to close (backdrop click)
            await this.page.click('body', { position: { x: 10, y: 10 } });
        }

        // Wait for modal to close
        await expect(this.getModalDialog()).not.toBeVisible({ timeout: 3000 });
    }

    async verifyErrorMessage(expectedError: string): Promise<void> {
        const errorMessage = this.getErrorMessage();
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(expectedError);
    }

    async verifyQRCodeVisible(): Promise<void> {
        const qrCode = this.getQRCode();
        await expect(qrCode).toBeVisible();
    }
}