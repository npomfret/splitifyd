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

    getCloseButton(): Locator {
        return this.getModalDialog().getByTestId('close-share-modal-button');
    }

    getLoadingSpinner(): Locator {
        return this.getModalDialog().locator('.animate-spin');
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

    // Element accessors for regeneration functionality
    getGenerateNewButton(): Locator {
        return this.getModalDialog().getByTestId('generate-new-link-button');
    }

    // Action methods for regeneration
    async clickGenerateNewLink(): Promise<void> {
        await this.waitForShareLinkLoaded(); // Ensure initial link is loaded first

        // Get the current share link before regeneration
        const initialShareLink = await this.getShareLink();

        // Click the "Generate New" button
        const generateNewButton = this.getGenerateNewButton();
        await this.clickButton(generateNewButton, { buttonName: 'Generate New' });

        // Wait for new share link to be generated
        await this.waitForNewShareLink(initialShareLink);
    }

    async waitForNewShareLink(previousLink: string, timeout: number = 10000): Promise<void> {
        // Wait for the share link to change from the previous one
        await expect(async () => {
            const currentLink = await this.getShareLinkInput().inputValue();

            if (!currentLink || !currentLink.includes('/join?')) {
                throw new Error(`Invalid share link: ${currentLink}`);
            }

            if (currentLink === previousLink) {
                throw new Error(`Share link has not changed yet. Current: ${currentLink}`);
            }
        }).toPass({ timeout });
    }

    async getNewShareLinkAfterRegeneration(previousLink: string): Promise<string> {
        await this.waitForNewShareLink(previousLink);
        return await this.getShareLink();
    }
}
