import { expect, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { MESSAGES, BUTTON_TEXTS, HEADINGS, ARIA_ROLES } from '../constants/selectors';
import { PooledTestUser } from '@splitifyd/shared';
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export class DashboardPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }
    // Selectors
    readonly url = '/dashboard';

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
            .filter({ hasText: /Create.*Group/i }) //there are several
            .first();
        await this.clickButton(createButton, { buttonName: 'Create Group' });

        // Wait for the modal dialog container to appear first (more reliable)
        await this.page.getByRole('dialog').waitFor({
            state: 'visible',
            timeout: 2000,
        });

        // Additional verification: wait for the modal heading to appear
        // This provides extra confidence that the modal content has fully loaded
        await this.page.getByRole('heading', { name: translationEn.createGroupModal.title }).waitFor({
            state: 'visible',
            timeout: 2000, // Shorter timeout since dialog should already be visible
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

    /**
     * Wait for a group with the specified name to not be present on the dashboard
     * This handles async deletion processes and real-time updates properly
     */
    async waitForGroupToNotBePresent(groupName: string, options: { timeout?: number } = {}) {
        const timeout = options.timeout || 5000; // Default 5 seconds - allow time for real-time updates
        
        await expect(async () => {
            // Use exact match to avoid partial matches with updated group names
            const groupCard = this.page.getByText(groupName, { exact: true });
            const isVisible = await groupCard.isVisible();
            if (isVisible) {
                throw new Error(`Group "${groupName}" is still visible on dashboard`);
            }
        }).toPass({
            timeout,
            intervals: [100, 250, 500, 1000], // Check frequently initially, then less frequently
        });
    }

    /**
     * Wait for a group with the specified name to appear on the dashboard
     * This handles async creation processes and real-time updates properly
     */
    async waitForGroupToAppear(groupName: string, options: { timeout?: number } = {}) {
        const timeout = options.timeout || 5000; // Default 5 seconds - allow time for real-time updates
        
        await expect(async () => {
            const groupCard = this.page.getByText(groupName);
            const isVisible = await groupCard.isVisible();
            if (!isVisible) {
                throw new Error(`Group "${groupName}" is not yet visible on dashboard`);
            }
        }).toPass({
            timeout,
            intervals: [100, 250, 500], // Check frequently for appearance
        });
    }

    /**
     * Click on a group card to navigate to the group details page
     * This simulates the user clicking on a group from the dashboard
     */
    async clickGroupCard(groupName: string) {
        // Ensure the group is visible first
        await this.waitForGroupToAppear(groupName);
        
        // Find the group card button and click it
        // Group cards are typically buttons containing the group name
        const groupCard = this.page.getByRole('button').filter({ hasText: groupName });
        await this.clickButton(groupCard, { buttonName: `Group: ${groupName}` });
        
        // Wait for navigation to complete
        await this.waitForDomContentLoaded();
    }

    /**
     * Clean up all existing groups for this user to ensure clean test state
     * This prevents cross-test contamination in pooled user scenarios
     */
    async cleanupUserGroups() {
        await this.navigate();
        await this.waitForDashboard();

        // Get all group buttons on the dashboard
        const groupButtons = this.page.getByRole('button').filter({ hasText: /^(?!.*Create.*Group).*/ });
        const groupCount = await groupButtons.count();
        
        console.log(`🧹 Cleaning up ${groupCount} existing groups for user`);
        
        // Delete all groups one by one
        for (let i = 0; i < groupCount; i++) {
            // Get fresh reference to first group (since DOM changes after each deletion)
            const remainingGroups = this.page.getByRole('button').filter({ hasText: /^(?!.*Create.*Group).*/ });
            const firstGroup = remainingGroups.first();
            
            // Check if any groups remain
            const remainingCount = await remainingGroups.count();
            if (remainingCount === 0) break;
            
            // Get group name for logging
            const groupName = await firstGroup.textContent();
            console.log(`🗑️ Deleting group: ${groupName}`);
            
            // Click the group to navigate to it
            await this.clickButton(firstGroup, { buttonName: `Group: ${groupName}` });
            await this.waitForDomContentLoaded();
            
            // Delete the group (assuming there's a delete option in group settings)
            try {
                // Look for group settings or delete button
                const settingsButton = this.page.getByRole('button', { name: /settings|delete|remove/i }).first();
                if (await settingsButton.isVisible({ timeout: 1000 })) {
                    await this.clickButton(settingsButton, { buttonName: 'Group Settings' });
                    
                    // Look for delete confirmation
                    const deleteButton = this.page.getByRole('button', { name: /delete|remove.*group/i });
                    if (await deleteButton.isVisible({ timeout: 1000 })) {
                        await this.clickButton(deleteButton, { buttonName: 'Delete Group' });
                        
                        // Confirm deletion if needed
                        const confirmButton = this.page.getByRole('button', { name: /confirm|yes|delete/i });
                        if (await confirmButton.isVisible({ timeout: 1000 })) {
                            await this.clickButton(confirmButton, { buttonName: 'Confirm Delete' });
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Could not delete group ${groupName}: ${error}`);
            }
            
            // Navigate back to dashboard
            await this.navigate();
            await this.waitForDashboard();
            
            // Wait for group to disappear
            if (groupName) {
                try {
                    await this.waitForGroupToNotBePresent(groupName, { timeout: 3000 });
                } catch (error) {
                    console.warn(`⚠️ Group ${groupName} still visible after deletion attempt`);
                }
            }
        }
        
        console.log(`✅ User cleanup complete`);
    }
}
