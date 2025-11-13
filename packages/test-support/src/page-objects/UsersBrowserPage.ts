import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the Users Browser page.
 * Provides methods for viewing and managing user accounts (system admin only).
 */
export class UsersBrowserPage extends BasePage {
    readonly url = '/browser/users';

    constructor(page: Page) {
        super(page);
    }

    /**
     * Navigate to users browser page
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });

        // Check if we successfully navigated
        try {
            await expect(this.page).toHaveURL(/\/browser\/users/);
        } catch (error) {
            // May have been denied access or redirected
            const url = this.page.url();
            if (url.includes('/browser/users')) {
                // We're on the page but might show access denied
                return;
            }
            throw new Error(`Expected to navigate to users browser page but was redirected to: ${url}`);
        }
    }

    /**
     * Page Header and Title
     */
    getPageTitle(): Locator {
        return this.page.locator('h1:has-text("Users Browser")');
    }

    /**
     * Tabs
     */
    getAuthTab(): Locator {
        return this.page.locator('button:has-text("Firebase Auth Users")');
    }

    getFirestoreTab(): Locator {
        return this.page.locator('button:has-text("Firestore Users")');
    }

    /**
     * Loading and Error States
     */
    getLoadingSpinner(): Locator {
        return this.page.locator('.animate-spin');
    }

    getErrorAlert(): Locator {
        return this.page.locator('[role="alert"]');
    }

    /**
     * Access Denied Message
     */
    getAccessDeniedMessage(): Locator {
        return this.page.locator('text=/you do not have permission/i');
    }

    /**
     * Auth Users Table
     */
    getAuthTable(): Locator {
        return this.page.locator('table').first();
    }

    getAuthTableRows(): Locator {
        return this.getAuthTable().locator('tbody tr');
    }

    /**
     * Get a specific user row by UID
     */
    getUserRowByUid(uid: string): Locator {
        return this.page.locator(`tr:has-text("${uid}")`);
    }

    /**
     * Get a specific user row by email
     */
    getUserRowByEmail(email: string): Locator {
        return this.page.locator(`tr:has-text("${email}")`);
    }

    /**
     * Status badges within a row
     */
    getStatusBadge(row: Locator): Locator {
        return row.locator('span.inline-flex.items-center.rounded-full');
    }

    /**
     * Disable/Enable buttons
     */
    getDisableButton(row: Locator): Locator {
        return row.locator('button:has-text("Disable")');
    }

    getEnableButton(row: Locator): Locator {
        return row.locator('button:has-text("Enable")');
    }

    /**
     * View JSON button
     */
    getViewJsonButton(row: Locator): Locator {
        return row.locator('button:has-text("View JSON")');
    }

    /**
     * Actions - Click disable/enable button
     */
    async clickDisableButton(row: Locator): Promise<void> {
        await this.getDisableButton(row).click();
    }

    async clickEnableButton(row: Locator): Promise<void> {
        await this.getEnableButton(row).click();
    }

    /**
     * Wait for confirmation dialog and handle it
     */
    async acceptConfirmation(): Promise<void> {
        // Wait for the browser's native confirm dialog
        this.page.once('dialog', async dialog => {
            await dialog.accept();
        });
    }

    async dismissConfirmation(): Promise<void> {
        // Wait for the browser's native confirm dialog
        this.page.once('dialog', async dialog => {
            await dialog.dismiss();
        });
    }

    /**
     * Get alert text (for success/error messages)
     */
    async getAlertText(): Promise<string | null> {
        try {
            // Wait for dialog
            const dialog = await this.page.waitForEvent('dialog', { timeout: 2000 });
            return dialog.message();
        } catch {
            return null;
        }
    }

    /**
     * Wait for table to load
     */
    async waitForAuthTableLoaded(): Promise<void> {
        await this.getAuthTable().waitFor({ state: 'visible', timeout: 10000 });
        await this.getLoadingSpinner().waitFor({ state: 'detached', timeout: 10000 });
    }

    /**
     * Verification methods
     */
    async verifyPageLoaded(): Promise<void> {
        await expect(this.getPageTitle()).toBeVisible({ timeout: 10000 });
    }

    async verifyAccessDenied(): Promise<void> {
        await expect(this.getAccessDeniedMessage()).toBeVisible({ timeout: 5000 });
    }

    async verifyLoadingSpinnerHidden(): Promise<void> {
        await expect(this.getLoadingSpinner()).not.toBeVisible();
    }

    /**
     * Check user status
     */
    async getUserStatus(row: Locator): Promise<'Active' | 'Disabled'> {
        const badge = this.getStatusBadge(row);
        const text = await badge.textContent();

        if (text?.includes('Active')) return 'Active';
        if (text?.includes('Disabled')) return 'Disabled';

        throw new Error(`Unknown status: ${text}`);
    }

    /**
     * Verify a user is disabled
     */
    async verifyUserIsDisabled(row: Locator): Promise<void> {
        const badge = this.getStatusBadge(row);
        await expect(badge).toContainText('Disabled');
        await expect(badge).toHaveClass(/bg-red-100/);
    }

    /**
     * Verify a user is enabled
     */
    async verifyUserIsEnabled(row: Locator): Promise<void> {
        const badge = this.getStatusBadge(row);
        await expect(badge).toContainText('Active');
        await expect(badge).toHaveClass(/bg-green-100/);
    }

    /**
     * Count users in the table
     */
    async countUsers(): Promise<number> {
        return await this.getAuthTableRows().count();
    }
}
