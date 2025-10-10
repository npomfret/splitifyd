import { expect, Page } from '@playwright/test';
import { ShareGroupModalPage as BaseShareGroupModalPage } from '@splitifyd/test-support';

/**
 * E2E-specific ShareGroupModalPage that extends the shared base class
 * Adds defensive checks for share link validation and regeneration
 */
export class ShareGroupModalPage extends BaseShareGroupModalPage {
    constructor(page: Page) {
        super(page);
    }

    /**
     * E2E version: Wait for share link with defensive validation
     * Overrides base class method to add link format validation
     */
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

    /**
     * E2E version: Get share link with validation
     * Overrides base class method to add defensive format checking
     */
    async getShareLink(): Promise<string> {
        await this.waitForShareLinkLoaded();

        const shareLinkInput = this.getShareLinkInput();
        const shareLink = await shareLinkInput.inputValue();

        if (!shareLink || !shareLink.includes('/join?')) {
            throw new Error(`Invalid share link received: ${shareLink}`);
        }

        return shareLink;
    }

    /**
     * E2E version: Close modal with fallback to backdrop click
     * More defensive than base clickClose() method
     */
    async closeModal(): Promise<void> {
        const closeButton = this.getCloseButton();
        if (await closeButton.isVisible()) {
            await this.clickButton(closeButton, { buttonName: 'Close' });
        } else {
            // Click outside modal to close (backdrop click)
            await this.page.click('body', { position: { x: 10, y: 10 } });
        }

        // Wait for modal to close
        await expect(this.getModalContainer()).not.toBeVisible({ timeout: 3000 });
    }

    /**
     * E2E version: Generate new link with defensive verification
     * Overrides base class method to add link change polling
     */
    async clickGenerateNewLink(): Promise<void> {
        await this.waitForShareLinkLoaded(); // Ensure initial link is loaded first

        // Get the current share link before regeneration
        const initialShareLink = await this.getShareLink();

        // Click the "Generate New" button
        const generateNewButton = this.getGenerateNewLinkButton();
        await this.clickButton(generateNewButton, { buttonName: 'Generate New' });

        // Wait for new share link to be generated
        await this.waitForNewShareLink(initialShareLink);
    }

    /**
     * E2E-specific: Wait for share link to change with validation
     */
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

    // ============================================================================
    // BACKWARD COMPATIBILITY ALIASES
    // ============================================================================

    /**
     * E2E compatibility: Alias for waitForModalToOpen
     */
    async waitForModalVisible(): Promise<void> {
        await this.waitForModalToOpen();
    }

    /**
     * E2E compatibility: Alias for getModalContainer
     */
    getModalDialog() {
        return this.getModalContainer();
    }

    /**
     * E2E compatibility: Alias for getGenerateNewLinkButton
     */
    getGenerateNewButton() {
        return this.getGenerateNewLinkButton();
    }
}
