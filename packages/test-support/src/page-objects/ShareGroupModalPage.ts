import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { loadTranslation } from './translation-loader';

const translation = loadTranslation();

/**
 * Share Group Modal Page Object Model for Playwright tests
 * Handles share link generation, copying, and QR code display
 * Reusable across unit tests and e2e tests
 */
export class ShareGroupModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER SELECTORS
    // ============================================================================

    /**
     * Modal container
     */
    getModalContainer(): Locator {
        return this.page.locator('[role="dialog"]').filter({
            has: this.page.locator('#share-modal-title')
        });
    }

    /**
     * Modal backdrop
     */
    getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]')
        });
    }

    /**
     * Toast notification
     */
    getToastNotification(): Locator {
        return this.page.locator('.fixed.bottom-4.right-4');
    }

    // ============================================================================
    // ELEMENT SELECTORS
    // ============================================================================

    /**
     * Share link input field
     */
    getShareLinkInput(): Locator {
        return this.getModalContainer().getByTestId('share-link-input');
    }

    /**
     * Copy link button
     */
    getCopyLinkButton(): Locator {
        return this.getModalContainer().getByTestId('copy-link-button');
    }

    /**
     * Generate new link button
     */
    getGenerateNewLinkButton(): Locator {
        return this.getModalContainer().getByTestId('generate-new-link-button');
    }

    /**
     * Close button (X icon)
     */
    getCloseButton(): Locator {
        return this.getModalContainer().getByTestId('close-share-modal-button');
    }

    /**
     * QR code canvas element
     */
    getQRCode(): Locator {
        return this.getModalContainer().locator('canvas');
    }

    /**
     * Loading spinner
     */
    getLoadingSpinner(): Locator {
        return this.getModalContainer().locator('.animate-spin');
    }

    /**
     * Error message
     */
    getErrorMessage(): Locator {
        return this.getModalContainer().getByTestId('share-group-error-message');
    }

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Check if modal is open
     */
    async isOpen(): Promise<boolean> {
        return await this.getModalContainer().isVisible();
    }

    /**
     * Check if modal is closed
     */
    async isClosed(): Promise<boolean> {
        return !(await this.isOpen());
    }

    /**
     * Check if loading
     */
    async isLoading(): Promise<boolean> {
        return await this.getLoadingSpinner().isVisible();
    }

    /**
     * Check if share link is displayed
     */
    async hasShareLink(): Promise<boolean> {
        return await this.getShareLinkInput().isVisible();
    }

    /**
     * Check if error is displayed
     */
    async hasError(): Promise<boolean> {
        return await this.getErrorMessage().isVisible();
    }

    /**
     * Check if QR code is displayed
     */
    async hasQRCode(): Promise<boolean> {
        return await this.getQRCode().isVisible();
    }

    /**
     * Check if toast notification is visible
     */
    async hasToastNotification(): Promise<boolean> {
        return await this.getToastNotification().isVisible();
    }

    /**
     * Get the share link value
     */
    async getShareLink(): Promise<string> {
        return await this.getShareLinkInput().inputValue();
    }

    /**
     * Get error message text
     */
    async getErrorText(): Promise<string> {
        await expect(this.getErrorMessage()).toBeVisible();
        return await this.getErrorMessage().textContent() || '';
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Wait for modal to open
     */
    async waitForModalToOpen(timeout = 2000): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout });
    }

    /**
     * Wait for modal to close
     */
    async waitForModalToClose(timeout = 2000): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible({ timeout });
    }

    /**
     * Wait for share link to be generated and displayed
     */
    async waitForShareLink(timeout = 5000): Promise<void> {
        await expect(this.getShareLinkInput()).toBeVisible({ timeout });
        await expect(this.getShareLinkInput()).not.toHaveValue('');
    }

    /**
     * Click copy link button
     */
    async clickCopyLink(): Promise<void> {
        const button = this.getCopyLinkButton();
        await this.clickButton(button, { buttonName: 'Copy Link' });
    }

    /**
     * Click generate new link button
     */
    async clickGenerateNewLink(): Promise<void> {
        const button = this.getGenerateNewLinkButton();
        await this.clickButton(button, { buttonName: 'Generate New Link' });
    }

    /**
     * Click close button
     */
    async clickClose(): Promise<void> {
        const button = this.getCloseButton();
        await button.click();
    }

    /**
     * Close modal by clicking backdrop
     */
    async clickOutsideToClose(): Promise<void> {
        const backdrop = this.getModalBackdrop();
        await backdrop.click({ position: { x: 10, y: 10 } });
    }

    /**
     * Close modal by pressing Escape
     * Waits for modal to be ready and event listener to be attached before pressing Escape
     */
    async pressEscapeToClose(): Promise<void> {
        const modal = this.getModalContainer();

        // Ensure modal is visible and event listener is attached
        await expect(modal).toBeVisible();

        // Small delay to ensure React useEffect has run and event listener is attached
        await this.page.waitForTimeout(50);

        // Press Escape once
        await this.page.keyboard.press('Escape');

        // Wait for modal to close (reasonable timeout for local unit test)
        await expect(modal).not.toBeVisible({ timeout: 1000 });
    }

    /**
     * Select share link text
     */
    async selectShareLink(): Promise<void> {
        const input = this.getShareLinkInput();
        await input.click();
    }

    /**
     * Copy share link to clipboard
     * Returns the copied link value
     */
    async copyShareLinkToClipboard(): Promise<string> {
        const linkBefore = await this.getShareLink();
        await this.clickCopyLink();

        // Wait for toast to appear confirming copy
        await expect(this.getToastNotification()).toBeVisible({ timeout: 2000 });

        return linkBefore;
    }

    /**
     * Generate a new share link and wait for it to update
     * Returns the new link value
     */
    async generateNewShareLink(): Promise<string> {
        const oldLink = await this.getShareLink();
        await this.clickGenerateNewLink();

        // Wait for link to change - poll the input value
        const input = this.getShareLinkInput();
        await expect(input).not.toHaveValue(oldLink, { timeout: 5000 });

        return await this.getShareLink();
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify modal is open with all elements
     */
    async verifyModalOpen(): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible();
        await expect(this.getCloseButton()).toBeVisible();
    }

    /**
     * Verify modal is closed
     */
    async verifyModalClosed(): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible();
    }

    /**
     * Verify loading state
     */
    async verifyLoading(): Promise<void> {
        await expect(this.getLoadingSpinner()).toBeVisible();
        await expect(this.getShareLinkInput()).not.toBeVisible();
    }

    /**
     * Verify share link is displayed with QR code
     */
    async verifyShareLinkDisplayed(): Promise<void> {
        await expect(this.getShareLinkInput()).toBeVisible();
        await expect(this.getShareLinkInput()).not.toHaveValue('');
        await expect(this.getQRCode()).toBeVisible();
        await expect(this.getCopyLinkButton()).toBeVisible();
        await expect(this.getGenerateNewLinkButton()).toBeVisible();
    }

    /**
     * Verify specific error message
     */
    async verifyErrorMessage(expectedMessage: string): Promise<void> {
        await expect(this.getErrorMessage()).toBeVisible();
        await expect(this.getErrorMessage()).toContainText(expectedMessage);
    }

    /**
     * Verify no error is displayed
     */
    async verifyNoError(): Promise<void> {
        const error = this.getErrorMessage();
        if (await error.count() > 0) {
            await expect(error).not.toBeVisible();
        }
    }

    /**
     * Verify copy success toast appears
     */
    async verifyCopySuccess(): Promise<void> {
        await expect(this.getToastNotification()).toBeVisible();
        await expect(this.getToastNotification()).toContainText(/copied/i);
    }

    /**
     * Verify toast notification disappears after timeout
     */
    async verifyToastDisappears(timeout = 4000): Promise<void> {
        await expect(this.getToastNotification()).not.toBeVisible({ timeout });
    }

    /**
     * Verify share link is a valid URL
     */
    async verifyShareLinkIsValidURL(): Promise<void> {
        const link = await this.getShareLink();
        expect(link).toMatch(/^https?:\/\/.+/);
    }

    /**
     * Verify QR code is rendered
     */
    async verifyQRCodeRendered(): Promise<void> {
        await expect(this.getQRCode()).toBeVisible();
        // Verify canvas has content (not empty)
        const canvas = await this.getQRCode().elementHandle();
        const hasContent = await canvas?.evaluate((el: any) => {
            const ctx = el.getContext('2d');
            if (!ctx) return false;
            const imageData = ctx.getImageData(0, 0, el.width, el.height);
            return imageData.data.some((pixel: number) => pixel !== 0);
        });
        expect(hasContent).toBe(true);
    }
}
