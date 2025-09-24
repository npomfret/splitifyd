import { Page, expect } from '@playwright/test';
import { PooledTestUser } from '@splitifyd/shared';

export class HeaderPage {
    constructor(
        private page: Page
    ) {}

    /**
     * User Menu Locators
     */
    getUserMenuButton() {
        return this.page.locator('[data-testid="user-menu-button"]');
    }

    getUserDropdownMenu() {
        return this.page.locator('[data-testid="user-dropdown-menu"]');
    }

    getDashboardLink() {
        return this.page.locator('[data-testid="user-menu-dashboard-link"]');
    }

    /**
     * Open the user menu dropdown using reliable ARIA-based state detection.
     */
    async openUserMenu(): Promise<void> {
        const userMenuButton = this.getUserMenuButton();
        const dropdownMenu = this.getUserDropdownMenu();

        // Ensure user menu button is visible and enabled
        await expect(userMenuButton).toBeVisible();
        await expect(userMenuButton).toBeEnabled();

        // Click to open dropdown
        await userMenuButton.click();

        // Wait for dropdown to be visible
        await expect(dropdownMenu).toBeVisible();

        // Check if dropdown opened using aria-expanded attribute
        const ariaExpanded = await userMenuButton.getAttribute('aria-expanded');
        if (ariaExpanded !== 'true') {
            // If aria-expanded not available or false, check for dropdown content visibility
            await expect(dropdownMenu).toBeVisible();
        }
    }

    /**
     * Logout the user using the user menu dropdown.
     * This is a common action available on most authenticated pages.
     */
    async logout(): Promise<void> {
        const userMenuButton = this.getUserMenuButton();
        const dropdownMenu = this.getUserDropdownMenu();

        // Ensure user menu button is visible and enabled
        await expect(userMenuButton).toBeVisible();
        await expect(userMenuButton).toBeEnabled();

        // Click to open dropdown
        await userMenuButton.click();

        // Wait for both the dropdown to be visible AND the sign-out button to be present
        await expect(dropdownMenu).toBeVisible();

        const signOutButton = dropdownMenu.locator('[data-testid="sign-out-button"]');
        await expect(signOutButton).toBeVisible();
        await expect(signOutButton).toBeEnabled();

        // Wait for the element to be stable (no animations/transitions)
        await signOutButton.waitFor({ state: 'attached' });

        // Click the sign-out button
        await signOutButton.click();

        // Wait for redirect to login page
        await expect(this.page).toHaveURL(/\/login/);
    }

    /**
     * Get the displayed user name from the user menu button.
     * This returns the current display name as shown in the UI, which may have been
     * modified by other tests (e.g., user profile management tests).
     */
    async getCurrentUserDisplayName(): Promise<string> {
        const userMenuButton = this.getUserMenuButton();
        await expect(userMenuButton).toBeVisible();

        // The user name is displayed in the menu button with specific classes
        const nameElement = userMenuButton.locator('.text-sm.font-medium.text-gray-700').first();
        const textContent = await nameElement.textContent();

        if (!textContent) {
            throw new Error('Could not extract user display name from user menu button');
        }

        return textContent.trim();
    }

    /**
     * Navigate to dashboard via user menu.
     * This method solves the circular dependency issue by avoiding dynamic imports.
     * Returns void - caller should create DashboardPage instance if needed.
     */
    async navigateToDashboard(): Promise<void> {
        await this.openUserMenu();
        await this.getDashboardLink().click();
        await expect(this.page).toHaveURL(/\/dashboard/);
        await this.page.waitForLoadState('domcontentloaded');
    }
}