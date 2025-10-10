import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Shared base class for Header page object.
 * Provides access to header navigation, user menu, and authentication actions.
 * Used as a component on most authenticated pages via `this.header`.
 */
export class HeaderPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    /**
     * User Menu Locators
     */
    getUserMenuButton(): Locator {
        return this.page.locator('[data-testid="user-menu-button"]');
    }

    getUserDropdownMenu(): Locator {
        return this.page.locator('[data-testid="user-dropdown-menu"]');
    }

    getDashboardLink(): Locator {
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
        const nameElement = this.page.locator('[data-testid="user-menu-display-name"]');
        await expect(nameElement).toBeVisible();

        const textContent = await nameElement.textContent();

        if (!textContent) {
            throw new Error('Could not extract user display name from user menu');
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
