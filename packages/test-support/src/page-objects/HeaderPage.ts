import { expect, Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

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
     * Notifications Dropdown Locators
     */
    protected getNotificationsBell(): Locator {
        return this.page.getByRole('button', { name: translation.notifications.openNotifications });
    }

    protected getNotificationsDropdown(): Locator {
        return this.page.getByRole('dialog', { name: translation.notifications.title });
    }

    protected getUnreadIndicator(): Locator {
        // CSS class selector: scoped to bell button, testing that red dot indicator
        // exists with semantic error styling (style assertion for visual indicator)
        return this.getNotificationsBell().locator('span.bg-semantic-error');
    }

    /**
     * User Menu Locators - using semantic selectors (aria-label, role)
     */
    protected getUserMenuButton(): Locator {
        return this.page.getByRole('button', { name: translation.navigation.userMenu.openUserMenu });
    }

    protected getUserDropdownMenu(): Locator {
        return this.page.getByRole('menu');
    }

    protected getDashboardLink(): Locator {
        return this.getUserDropdownMenu().getByRole('menuitem', { name: translation.userMenu.dashboard });
    }

    protected getAdminLink(): Locator {
        return this.getUserDropdownMenu().getByRole('menuitem', { name: translation.userMenu.admin });
    }

    protected getSettingsLink(): Locator {
        return this.getUserDropdownMenu().getByRole('menuitem', { name: translation.userMenu.settings });
    }

    protected getSignOutButton(): Locator {
        return this.getUserDropdownMenu().getByRole('menuitem', { name: translation.userMenu.signOut });
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
     * Close the user menu dropdown by clicking the user menu button.
     */
    async closeUserMenu(): Promise<void> {
        const userMenuButton = this.getUserMenuButton();
        const dropdownMenu = this.getUserDropdownMenu();

        // Click to close dropdown
        await userMenuButton.click();

        // Wait for dropdown to be hidden
        await expect(dropdownMenu).not.toBeVisible();
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

        const signOutButton = this.getSignOutButton();
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
        const nameElement = this.getUserMenuButton().locator(`[aria-label="${translation.navigation.userMenu.displayNameLabel}"]`);
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

    /**
     * Verify user menu button contains specific text
     * Uses Playwright's built-in polling for async content
     */
    async verifyUserMenuButtonContainsText(expectedText: string): Promise<void> {
        const userMenuButton = this.getUserMenuButton();
        await expect(userMenuButton).toContainText(expectedText);
    }

    async verifyUserDropdownVisible(): Promise<void> {
        await expect(this.getUserDropdownMenu()).toBeVisible();
    }

    async verifyDashboardMenuItemVisible(): Promise<void> {
        await expect(this.getDashboardLink()).toBeVisible();
    }

    async verifySettingsMenuItemVisible(): Promise<void> {
        await expect(this.getSettingsLink()).toBeVisible();
    }

    async verifySignOutMenuItemVisible(): Promise<void> {
        await expect(this.getSignOutButton()).toBeVisible();
    }

    async verifyUserMenuButtonVisible(): Promise<void> {
        await expect(this.getUserMenuButton()).toBeVisible();
    }

    async verifyUserDropdownMenuVisible(): Promise<void> {
        await expect(this.getUserDropdownMenu()).toBeVisible();
    }

    async verifyUserDropdownMenuNotVisible(): Promise<void> {
        await expect(this.getUserDropdownMenu()).not.toBeVisible();
    }

    async verifyDashboardLinkVisible(): Promise<void> {
        await expect(this.getDashboardLink()).toBeVisible();
    }

    async verifyAdminLinkVisible(): Promise<void> {
        await expect(this.getAdminLink()).toBeVisible();
    }

    /**
     * Open user menu and verify admin link is visible.
     * Useful for verifying user has been promoted to admin role.
     */
    async openUserMenuAndVerifyAdminLinkVisible(): Promise<void> {
        await this.openUserMenu();
        await this.verifyAdminLinkVisible();
    }

    /**
     * Header branding locators
     */
    protected getHeader(): Locator {
        return this.page.locator('header');
    }

    protected getAppNameText(appName: string): Locator {
        return this.getHeader().locator('span', { hasText: appName });
    }

    /**
     * Verify header is visible on the page
     */
    async verifyHeaderVisible(): Promise<void> {
        await expect(this.getHeader()).toBeVisible();
    }

    /**
     * Verify app name is displayed in the header
     */
    async verifyAppNameVisible(appName: string): Promise<void> {
        await expect(this.getAppNameText(appName)).toBeVisible();
    }

    /**
     * Verify app name is NOT displayed in the header
     */
    async verifyAppNameNotVisible(appName: string): Promise<void> {
        await expect(this.getAppNameText(appName)).toHaveCount(0);
    }

    // ==========================================
    // Notifications Dropdown Actions
    // ==========================================

    /**
     * Open the notifications dropdown
     */
    async openNotificationsDropdown(): Promise<void> {
        const bellButton = this.getNotificationsBell();
        await expect(bellButton).toBeVisible();
        await expect(bellButton).toBeEnabled();
        await bellButton.click();
        await expect(this.getNotificationsDropdown()).toBeVisible();
    }

    /**
     * Close the notifications dropdown by clicking the bell button again
     */
    async closeNotificationsDropdown(): Promise<void> {
        const bellButton = this.getNotificationsBell();
        await bellButton.click();
        await expect(this.getNotificationsDropdown()).not.toBeVisible();
    }

    /**
     * Click a notification item by its description text
     */
    async clickNotificationItem(description: string): Promise<void> {
        const dropdown = this.getNotificationsDropdown();
        await expect(dropdown).toBeVisible();
        const item = dropdown.getByRole('button', { name: description });
        await expect(item).toBeVisible();
        await item.click();
    }

    // ==========================================
    // Notifications Dropdown Verifications
    // ==========================================

    /**
     * Verify notifications bell button is visible
     */
    async verifyNotificationsBellVisible(): Promise<void> {
        await expect(this.getNotificationsBell()).toBeVisible();
    }

    /**
     * Verify notifications dropdown is visible
     */
    async verifyNotificationsDropdownVisible(): Promise<void> {
        await expect(this.getNotificationsDropdown()).toBeVisible();
    }

    /**
     * Verify notifications dropdown is not visible
     */
    async verifyNotificationsDropdownNotVisible(): Promise<void> {
        await expect(this.getNotificationsDropdown()).not.toBeVisible();
    }

    /**
     * Verify unread indicator (red dot) is visible on bell
     */
    async verifyUnreadIndicatorVisible(): Promise<void> {
        await expect(this.getUnreadIndicator()).toBeVisible();
    }

    /**
     * Verify unread indicator (red dot) is not visible on bell
     */
    async verifyUnreadIndicatorNotVisible(): Promise<void> {
        await expect(this.getUnreadIndicator()).not.toBeVisible();
    }

    /**
     * Verify notifications dropdown contains specific text
     */
    async verifyNotificationsContainsText(text: string): Promise<void> {
        const dropdown = this.getNotificationsDropdown();
        await expect(dropdown).toBeVisible();
        await expect(dropdown.getByText(text)).toBeVisible();
    }
}
