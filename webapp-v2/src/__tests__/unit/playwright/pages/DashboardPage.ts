import { expect, Page } from '@playwright/test';
import { BasePage } from '@splitifyd/test-support';
import type { RegisteredUser as BaseUser } from '@splitifyd/shared';

/**
 * DashboardPage for webapp-v2 unit tests
 * Handles dashboard UI interactions for groups store testing
 */
export class DashboardPage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }

    // URL and routes
    readonly url = '/dashboard';

    /**
     * Navigate to dashboard page
     */
    async navigate() {
        await this.navigateToPath(this.url);
        await this.waitForDashboardReady();
    }

    /**
     * Wait for dashboard to be ready for interaction
     */
    async waitForDashboardReady(): Promise<void> {
        await this.waitForDomContentLoaded();
        await expect(this.getDashboardContainer()).toBeVisible();
    }

    // Element accessors for groups functionality
    getDashboardContainer() {
        return this._page.locator('[data-testid="dashboard"], .dashboard-container, main');
    }

    getCreateGroupButton() {
        return this._page.getByRole('button', { name: /create.*group|new.*group/i });
    }

    getGroupCard(groupName?: string) {
        if (groupName) {
            return this._page.locator('[data-testid="group-card"]').filter({ hasText: groupName });
        }
        return this._page.locator('[data-testid="group-card"]');
    }

    getEmptyGroupsState() {
        return this._page.locator('[data-testid="empty-groups"], .empty-state').filter({ hasText: /no.*groups|create.*first/i });
    }

    getLoadingSpinner() {
        return this._page.locator('[data-testid="loading"], .loading-spinner, .spinner');
    }

    getErrorMessage() {
        return this._page.locator('[data-testid="error-message"], .error-message').filter({ hasText: /error|failed/i });
    }

    /**
     * Wait for groups to load (either show groups or empty state)
     */
    async waitForGroupsLoaded(): Promise<void> {
        try {
            // Wait for either groups to appear or empty state
            await Promise.race([
                expect(this.getGroupCard()).toBeVisible({ timeout: 3000 }),
                expect(this.getEmptyGroupsState()).toBeVisible({ timeout: 3000 })
            ]);
        } catch (error) {
            // If neither appears, just make sure loading is done
            await expect(this.getLoadingSpinner()).not.toBeVisible({ timeout: 1000 }).catch(() => {});
        }
    }

    // Create group modal interactions (if modal opens on dashboard)
    getCreateGroupModal() {
        return this._page.locator('[data-testid="create-group-modal"], .modal').filter({ hasText: /create.*group/i });
    }

    getGroupNameInput() {
        return this._page.locator('[data-testid="group-name-input"]').or(
            this._page.getByLabel(/group.*name/i)
        );
    }

    getModalSubmitButton() {
        return this._page.getByRole('button', { name: /create|save/i }).last();
    }

    getModalCancelButton() {
        return this._page.getByRole('button', { name: /cancel|close/i });
    }
}