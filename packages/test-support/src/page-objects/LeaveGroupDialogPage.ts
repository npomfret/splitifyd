import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';

/**
 * Leave Group Dialog Page Object Model for Playwright tests
 * Handles leave group confirmation with outstanding balance warnings
 * Reusable across unit tests and e2e tests
 */
export class LeaveGroupDialogPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // CONTAINER SELECTORS
    // ============================================================================

    /**
     * Main dialog container
     */
    getDialogContainer(): Locator {
        return this.page.getByTestId('leave-group-dialog');
    }

    /**
     * Inner confirmation dialog
     */
    getConfirmationDialog(): Locator {
        return this.page.getByTestId('confirmation-dialog');
    }

    /**
     * Dialog backdrop
     */
    getDialogBackdrop(): Locator {
        return this.getDialogContainer();
    }

    // ============================================================================
    // ELEMENT SELECTORS
    // ============================================================================

    /**
     * Dialog title
     */
    getDialogTitle(): Locator {
        return this.getConfirmationDialog().locator('h3');
    }

    /**
     * Dialog message
     */
    getDialogMessage(): Locator {
        return this.getConfirmationDialog().locator('p.text-sm');
    }

    /**
     * Outstanding balance warning message
     */
    getBalanceWarningMessage(): Locator {
        return this.getConfirmationDialog().getByTestId('balance-error-message');
    }

    /**
     * Confirm button
     */
    getConfirmButton(): Locator {
        return this.getConfirmationDialog().getByTestId('confirm-button');
    }

    /**
     * Cancel button
     */
    getCancelButton(): Locator {
        return this.getConfirmationDialog().getByTestId('cancel-button');
    }

    /**
     * Warning icon (displayed when variant is warning)
     */
    getWarningIcon(): Locator {
        return this.getConfirmationDialog().locator('svg').first();
    }

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Check if showing outstanding balance warning
     */
    async hasOutstandingBalanceWarning(): Promise<boolean> {
        const message = await this.getDialogMessage().textContent();
        return message?.includes('outstanding balance') || message?.includes('settle') || false;
    }

    /**
     * Get dialog message text
     */
    async getMessageText(): Promise<string> {
        return (await this.getDialogMessage().textContent()) || '';
    }

    /**
     * Get confirm button text
     */
    async getConfirmButtonText(): Promise<string> {
        return (await this.getConfirmButton().textContent()) || '';
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Wait for dialog to open
     */
    async waitForDialogToOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getDialogContainer()).toBeVisible({ timeout });
        await expect(this.getConfirmationDialog()).toBeVisible();
        await expect(this.getConfirmButton()).toBeVisible();
        await expect(this.getCancelButton()).toBeVisible();
    }

    /**
     * Wait for dialog to close
     */
    async waitForDialogToClose(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getDialogContainer()).not.toBeVisible({ timeout });
    }

    /**
     * Click confirm button
     */
    async clickConfirm(): Promise<void> {
        const button = this.getConfirmButton();
        await this.clickButton(button, { buttonName: 'Confirm Leave' });
    }

    /**
     * Click cancel button
     */
    async clickCancel(): Promise<void> {
        const button = this.getCancelButton();
        await this.clickButton(button, { buttonName: 'Cancel' });
    }

    /**
     * Close dialog by clicking backdrop
     */
    async clickOutsideToClose(): Promise<void> {
        const backdrop = this.getDialogBackdrop();
        await backdrop.click({ position: { x: 10, y: 10 } });
    }

    /**
     * Close dialog by pressing Escape
     */
    async pressEscapeToClose(): Promise<void> {
        await super.pressEscapeToClose(this.getDialogContainer());
    }

    // ============================================================================
    // WORKFLOW METHODS
    // ============================================================================

    /**
     * Complete leave group workflow: confirm and wait for redirect
     * Use when expecting successful leave (no outstanding balance)
     */
    async confirmLeaveAndWaitForRedirect(): Promise<void> {
        await this.clickConfirm();
        // Wait for dialog to close (indicates successful leave)
        await this.waitForDialogToClose();
        // Wait for URL change to dashboard
        await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    }

    /**
     * Attempt to leave with outstanding balance and verify blocked
     * Use when expecting leave to be prevented due to balance
     */
    async attemptLeaveWithBalance(): Promise<void> {
        // Verify warning is shown
        await this.verifyOutstandingBalanceWarning();

        // Click confirm - but this should not actually leave
        await this.clickConfirm();

        // Dialog should remain open (leave was blocked)
        await expect(this.getDialogContainer()).toBeVisible();
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify dialog is open with correct structure
     */
    async verifyDialogOpen(): Promise<void> {
        await expect(this.getDialogContainer()).toBeVisible();
        await expect(this.getConfirmationDialog()).toBeVisible();
        await expect(this.getDialogTitle()).toBeVisible();
        await expect(this.getDialogMessage()).toBeVisible();
        await expect(this.getConfirmButton()).toBeVisible();
        await expect(this.getCancelButton()).toBeVisible();
    }

    /**
     * Verify dialog is closed
     */
    async verifyDialogClosed(): Promise<void> {
        await expect(this.getDialogContainer()).not.toBeVisible();
    }

    /**
     * Verify dialog shows standard leave confirmation (no balance issues)
     */
    async verifyStandardLeaveConfirmation(): Promise<void> {
        await expect(this.getDialogTitle()).toBeVisible();
        await expect(this.getDialogMessage()).toBeVisible();

        // Confirm button should show "Leave" or similar action text
        const confirmText = await this.getConfirmButtonText();
        expect(confirmText.toLowerCase()).toMatch(/leave|confirm/);

        // Should not show balance warning
        const hasWarning = await this.hasOutstandingBalanceWarning();
        expect(hasWarning).toBe(false);
    }

    /**
     * Verify dialog shows outstanding balance warning
     */
    async verifyOutstandingBalanceWarning(): Promise<void> {
        await expect(this.getDialogTitle()).toBeVisible();
        await expect(this.getDialogMessage()).toBeVisible();

        // Message should mention outstanding balance
        const message = await this.getMessageText();
        expect(message.toLowerCase()).toMatch(/outstanding balance|settle|owe|owed/);

        // Confirm button should show "Understood" or similar acknowledgment
        const confirmText = await this.getConfirmButtonText();
        expect(confirmText.toLowerCase()).toMatch(/understood|ok/);
    }

    /**
     * Verify specific message text
     */
    async verifyMessage(expectedMessage: string): Promise<void> {
        await expect(this.getDialogMessage()).toBeVisible();
        await expect(this.getDialogMessage()).toContainText(expectedMessage);
    }

    /**
     * Verify dialog variant (warning vs info)
     */
    async verifyDialogVariant(expectedVariant: 'warning' | 'info'): Promise<void> {
        const icon = this.getWarningIcon();
        await expect(icon).toBeVisible();

        if (expectedVariant === 'warning') {
            // Warning icon should have yellow/warning colors
            const classes = await icon.locator('..').getAttribute('class');
            expect(classes).toMatch(/yellow|warning/);
        } else {
            // Info icon should have blue/info colors
            const classes = await icon.locator('..').getAttribute('class');
            expect(classes).toMatch(/blue|info/);
        }
    }

    /**
     * Verify confirm button state
     */
    async verifyConfirmButtonState(shouldBeEnabled: boolean): Promise<void> {
        if (shouldBeEnabled) {
            await expect(this.getConfirmButton()).toBeEnabled();
        } else {
            await expect(this.getConfirmButton()).toBeDisabled();
        }
    }
}
