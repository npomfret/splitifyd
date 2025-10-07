import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { loadTranslation } from './translation-loader';
import { TEST_TIMEOUTS } from '../test-constants';

const translation = loadTranslation();

/**
 * Share Group Modal Page Object Model for Playwright tests
 * Handles share link generation, copying, and QR code display
 * Reusable across unit tests and e2e tests
 *
 * Note: Modals don't navigate to other pages, so they don't follow the fluent
 * navigation pattern. Methods that perform actions may return values (like
 * copyShareLinkToClipboard() returns the copied link).
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
            has: this.page.locator('#share-modal-title'),
        });
    }

    /**
     * Modal backdrop
     */
    getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]'),
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
     * Get the share link value
     */
    async getShareLink(): Promise<string> {
        return await this.getShareLinkInput().inputValue();
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Wait for modal to open
     */
    async waitForModalToOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout });
    }

    /**
     * Wait for modal to close
     */
    async waitForModalToClose(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible({ timeout });
    }

    /**
     * Wait for share link to be generated and displayed
     */
    async waitForShareLink(timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
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
     */
    async pressEscapeToClose(): Promise<void> {
        await super.pressEscapeToClose(this.getModalContainer());
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
        await expect(this.getToastNotification()).toBeVisible({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });

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
        await expect(input).not.toHaveValue(oldLink, { timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

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
        await expect(this.getErrorMessage()).not.toBeVisible();
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
     * Toast is programmed to show for 3 seconds, so we wait slightly longer
     */
    async verifyToastDisappears(timeout: number = TEST_TIMEOUTS.ERROR_DISPLAY + 1000): Promise<void> {
        await expect(this.getToastNotification()).not.toBeVisible({ timeout });
    }
}
