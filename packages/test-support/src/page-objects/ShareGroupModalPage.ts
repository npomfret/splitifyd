import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

/**
 * Share Group Modal Page Object Model for Playwright tests
 * Handles share link generation, copying, and QR code display
 * Reusable across unit tests and e2e tests
 *
 * ## Modal Interaction Pattern
 *
 * Modals don't navigate to other pages, so they don't follow the fluent
 * navigation pattern. Methods that perform actions may return values (like
 * copyShareLinkToClipboard() returns the copied link).
 *
 * - Modal methods perform actions and may return values
 * - They do NOT return page objects (modals don't navigate)
 * - Use the parent page's fluent method to open modals (e.g., `clickGroupCardInviteButton()`)
 * - Once you have the modal page object, interact with it directly
 *
 * @example
 * // Open modal using parent page's fluent method
 * const shareModal = await dashboardPage.clickGroupCardInviteButton('My Group');
 *
 * // Interact with modal directly
 * await shareModal.verifyShareLinkDisplayed();
 * const link = await shareModal.copyShareLinkToClipboard();
 * await shareModal.clickClose();
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
    protected getModalContainer(): Locator {
        return this.page.getByRole('dialog', { name: translation.shareGroupModal.title });
    }

    /**
     * Modal backdrop
     */
    protected getModalBackdrop(): Locator {
        return this.page.locator('[role="presentation"]').filter({
            has: this.page.locator('[role="dialog"]'),
        });
    }

    /**
     * Copy success indicator (checkmark icon that appears after successful copy).
     * CSS class selector: scoped to copy button, testing that success icon
     * appears with semantic success styling (style assertion for visual feedback).
     */
    protected getCopySuccessIcon(): Locator {
        return this.getCopyLinkButton().locator('svg.text-semantic-success');
    }

    // ============================================================================
    // ELEMENT SELECTORS
    // ============================================================================

    /**
     * Share link input field
     */
    protected getShareLinkInput(): Locator {
        // Readonly text input containing the share URL
        return this.getModalContainer().getByRole('textbox');
    }

    /**
     * Copy link button (has aria-label)
     */
    protected getCopyLinkButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.shareGroupModal.copyLinkAriaLabel });
    }

    /**
     * Generate new link button (has aria-label)
     */
    protected getGenerateNewLinkButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.shareGroupModal.generateNew });
    }

    /**
     * Close button (X icon, has aria-label)
     */
    protected getCloseButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translation.shareGroupModal.closeButtonAriaLabel });
    }

    /**
     * QR code canvas element
     */
    protected getQRCode(): Locator {
        return this.getModalContainer().locator('canvas');
    }

    /**
     * Loading spinner - uses role='status' for semantic selection
     */
    protected getLoadingSpinner(): Locator {
        return this.getModalContainer().getByRole('status', { name: translation.uiComponents.loadingSpinner.loading });
    }

    /**
     * Error message (has role='alert')
     */
    protected getErrorMessage(): Locator {
        return this.getModalContainer().getByRole('alert');
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
     * Wait for modal container to open (basic check)
     * Does NOT wait for share link generation - use for error/loading state tests
     */
    async waitForModalToOpenBasic(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout });
    }

    /**
     * Wait for modal to open and share link to be ready
     * Modal opens with a loading spinner while generating the share link
     * This ensures the fluent interface returns a ready-to-use modal
     */
    async waitForModalToOpen(timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        // Wait for modal container to appear
        await expect(this.getModalContainer()).toBeVisible({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });

        // Wait for loading to complete (spinner disappears)
        await expect(this.getLoadingSpinner()).not.toBeVisible({ timeout });

        // Wait for share link input to be visible and populated
        await this.waitForShareLink(timeout);
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
        await this.clickButton(button, { buttonName: translation.shareGroupModal.copyLinkAriaLabel });
    }

    /**
     * Click generate new link button
     */
    async clickGenerateNewLink(): Promise<void> {
        const button = this.getGenerateNewLinkButton();
        await this.clickButton(button, { buttonName: translation.shareGroupModal.generateNew });
    }

    /**
     * Get expiration option button by its value
     * Uses translated button text instead of test-id
     */
    protected getExpirationOption(optionValue: '15m' | '1h' | '1d' | '5d'): Locator {
        const labelMap: Record<string, string> = {
            '15m': translation.shareGroupModal.expirationOptions['15m'],
            '1h': translation.shareGroupModal.expirationOptions['1h'],
            '1d': translation.shareGroupModal.expirationOptions['1d'],
            '5d': translation.shareGroupModal.expirationOptions['5d'],
        };
        return this.getModalContainer().getByRole('button', { name: labelMap[optionValue] });
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
     * Copy share link to clipboard
     * Returns the copied link value
     */
    async copyShareLinkToClipboard(): Promise<string> {
        const linkBefore = await this.getShareLink();
        await this.clickCopyLink();

        // Wait for checkmark icon to appear confirming copy
        await expect(this.getCopySuccessIcon()).toBeVisible({ timeout: TEST_TIMEOUTS.MODAL_TRANSITION });

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
     * Alias for clickClose with modal close wait
     */
    async closeModal(): Promise<void> {
        await this.clickClose();
        await this.waitForModalToClose();
    }

    /**
     * Verify modal is not visible
     */
    async verifyModalNotVisible(): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible();
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
     * Verify copy success indicator appears (checkmark icon)
     */
    async verifyCopySuccess(): Promise<void> {
        await expect(this.getCopySuccessIcon()).toBeVisible();
    }

    /**
     * Verify share link contains expected language parameter
     * @param expectedLang - The expected language code (e.g., 'de', 'es')
     */
    async verifyShareLinkContainsLang(expectedLang: string): Promise<void> {
        const link = await this.getShareLink();
        expect(link).toContain(`lang=${expectedLang}`);
    }

    /**
     * Verify share link does NOT contain a lang parameter (for English)
     */
    async verifyShareLinkHasNoLangParam(): Promise<void> {
        const link = await this.getShareLink();
        expect(link).not.toContain('lang=');
    }
}
