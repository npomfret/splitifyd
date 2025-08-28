import { expect, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { MESSAGES, BUTTON_TEXTS, HEADINGS, ARIA_ROLES } from '../constants/selectors';
import type { User as BaseUser } from '@splitifyd/shared';
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class DashboardPage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }
    // Selectors
    readonly url = '/dashboard';
    readonly userNameText = '.text-sm.font-medium.text-gray-700';

    async navigate() {
        await this.page.goto(this.url);
        await this.waitForDomContentLoaded();
    }

    async isLoggedIn(): Promise<boolean> {
        try {
            // Check for "Your Groups" heading - always present when logged in
            const groupsHeading = await this.getGroupsHeading()
                .isVisible({ timeout: 2000 })
                .catch(() => false);
            if (groupsHeading) return true;

            // Fallback: welcome message for users with no groups
            const welcomeMessage = await this.getWelcomeMessage()
                .isVisible({ timeout: 1000 })
                .catch(() => false);
            return welcomeMessage;
        } catch {
            return false;
        }
    }

    // Element accessors specific to Dashboard
    getWelcomeMessage() {
        return this.page.getByText(MESSAGES.WELCOME_BACK);
    }

    getGroupsHeading() {
        return this.page.getByRole(ARIA_ROLES.HEADING, { name: HEADINGS.YOUR_GROUPS });
    }

    getCreateGroupButton() {
        return this.page.getByRole('button', { name: /Create.*Group/i }).first();
    }

    getSignInButton() {
        return this.page.getByRole(ARIA_ROLES.BUTTON, { name: BUTTON_TEXTS.SIGN_IN });
    }

    /**
     * Override waitForUserMenu to also check for dashboard-specific elements.
     */
    async waitForUserMenu(): Promise<void> {
        // Wait for authentication state to be fully loaded first
        await this.waitForDomContentLoaded();

        // Ensure we're logged in by checking for either welcome message (new users) or groups heading
        // Since welcome message only shows for users with no groups, check for groups heading as primary indicator
        await expect(this.getGroupsHeading()).toBeVisible();

        // Call parent implementation to wait for user menu
        await super.waitForUserMenu();
    }

    async openCreateGroupModal() {
        // Simply click the first visible create group button
        const createButton = this.page
            .getByRole('button')
            .filter({ hasText: /Create.*Group/i })//there are several
            .first();
        await this.clickButton(createButton, { buttonName: 'Create Group' });
        
        // Wait for the modal dialog container to appear first (more reliable)
        await this.page.getByRole('dialog').waitFor({
            state: 'visible',
            timeout: 2000
        });
        
        // Additional verification: wait for the modal heading to appear
        // This provides extra confidence that the modal content has fully loaded
        await this.page.getByRole('heading', { name: translationEn.createGroupModal.title }).waitFor({
            state: 'visible',
            timeout: 2000  // Shorter timeout since dialog should already be visible
        });
    }

    async waitForDashboard() {
        // Wait for navigation to dashboard if not already there - handle both /dashboard and /dashboard/
        await expect(this.page).toHaveURL(/\/dashboard\/?$/);

        // Wait for the dashboard to be fully loaded
        await this.waitForDomContentLoaded();

        // Wait for the main dashboard content to appear
        await this.page.locator('h3:has-text("Your Groups")').waitFor();

        // Wait for loading spinner to disappear (handles race condition where spinner might never appear)
        const loadingSpinner = this.page.locator('span:has-text("Loading your groups")');
        try {
            await loadingSpinner.waitFor({ state: 'hidden', timeout: 1000 });
        } catch {
            // Spinner never appeared or disappeared quickly - expected behavior
        }

        // Wait for DOM to be fully loaded instead of arbitrary timeout
        await this.waitForDomContentLoaded();

        // Dashboard is now ready - we don't check for specific content since users may have existing groups
    }

    async signOut() {
        // Ensure we're logged in first
        await this.waitForUserMenu();

        // Click user menu button to open dropdown
        const userMenuButton = this.getUserMenuButton();
        await this.clickButton(userMenuButton, { buttonName: 'User Menu' });

        // Wait for dropdown to appear and click sign out
        const signOutButton = this.getSignOutButton();
        await expect(signOutButton).toBeVisible();
        await this.clickButton(signOutButton, { buttonName: 'Sign Out' });

        // Wait for redirect to login page after sign out
        await expect(this.page).toHaveURL(/\/login/);
    }

    // Security testing methods
    getDashboardTestId() {
        return this.page.locator('[data-testid="dashboard"]');
    }

    getCreateGroupButtonTestId() {
        return this.page.locator('[data-testid="create-group-button"]');
    }

    getGroupNameInputTestId() {
        return this.page.locator('[data-testid="group-name-input"]');
    }

    getGroupDescriptionInputTestId() {
        return this.page.locator('[data-testid="group-description-input"]');
    }

    getCreateGroupFormTestId() {
        return this.page.locator('[data-testid="create-group-form"], form');
    }

    getCreateGroupSubmitTestId() {
        return this.page.locator('[data-testid="create-group-submit"]');
    }

    getLogoutButtonTestId() {
        return this.page.locator('[data-testid="logout-button"], [data-testid="user-menu"]');
    }

    getLogoutConfirmTestId() {
        return this.page.locator('[data-testid="logout-confirm"], text=Logout, text=Sign out');
    }

    getGroupCard() {
        return this.page.locator('[data-testid="group-card"]').first();
    }
}
