import {expect, Locator, Page} from '@playwright/test';
import {BasePage} from './base.page';
import {TIMEOUT_CONTEXTS} from '../config/timeouts';
import type {User as BaseUser} from '@splitifyd/shared';
import {groupDetailUrlPattern} from "./group-detail.page.ts";

/**
 * Page object for join group functionality via share links.
 * Handles different authentication states and provides robust join operations.
 */
export class JoinGroupPage extends BasePage {
    constructor(page: Page, userInfo?: BaseUser) {
        super(page, userInfo);
    }

    // Core selectors with retry logic
    getJoinGroupHeading(): Locator {
        return this.page.getByRole('heading', {name: /join group/i});
    }

    getJoinGroupButton(): Locator {
        return this.page.getByRole('button', {name: /join group/i});
    }

    getAlreadyMemberMessage(): Locator {
        return this.page.getByText(/already.*member|you.*already.*part/i);
    }

    getGroupNameHeading(): Locator {
        return this.page.getByRole('heading').first();
    }

    getLoginButton(): Locator {
        return this.page.getByRole('button', {name: /login|sign in/i});
    }

    getRegisterButton(): Locator {
        return this.page.getByRole('button', {name: /register|sign up/i});
    }

    getErrorMessage(): Locator {
        return this.page.getByText(/error|not found|invalid/i);
    }

    getSpecificErrorMessage(pattern: string | RegExp): Locator {
        return this.page.getByText(pattern);
    }

    getBackToDashboardButton(): Locator {
        return this.page.getByRole('button', {name: /back to dashboard/i});
    }

    // Authentication state detection
    async isUserLoggedIn(): Promise<boolean> {
        try {
            // First check: If we're on the login page, definitely not logged in
            const currentUrl = this.page.url();
            if (currentUrl.includes('/login') || currentUrl.includes('/register')) {
                return false;
            }

            // Second check: Look for authentication loading states
            const checkingAuth = await this.page
                .getByText('Checking authentication...')
                .isVisible({timeout: 500})
                .catch(() => false);
            if (checkingAuth) {
                // Wait for auth check to complete
                await this.waitForDomContentLoaded();
                // Re-check URL after auth check
                if (this.page.url().includes('/login')) {
                    return false;
                }
            }

            // FIRST: Special case for join group page - if we can see join elements, user is authenticated
            const joinButtonVisible = await this.getJoinGroupButton()
                .isVisible({timeout: 1000})
                .catch(() => false);
            const joinGroupHeadingVisible = await this.getJoinGroupHeading()
                .isVisible({timeout: 1000})
                .catch(() => false);
            const groupInviteMessage = await this.page
                .getByText(/you've been invited|invited to join/i)
                .isVisible({timeout: 1000})
                .catch(() => false);

            if (joinButtonVisible || joinGroupHeadingVisible || groupInviteMessage) {
                return true;
            }

            // Then check: Look for login/register UI elements (reliable indicator for other pages)
            const loginVisible = await this.getLoginButton()
                .isVisible({timeout: 1000})
                .catch(() => false);
            const registerVisible = await this.getRegisterButton()
                .isVisible({timeout: 1000})
                .catch(() => false);

            // If we see login/register buttons, user is definitely not logged in
            if (loginVisible || registerVisible) {
                return false;
            }

            // Look for user-specific UI elements that indicate login
            const userMenuVisible = await this.page
                .locator('[data-testid="user-menu-button"]')
                .isVisible({timeout: 1000})
                .catch(() => false);

            // If we see user menu, definitely logged in
            if (userMenuVisible) {
                return true;
            }

            // Final check: Look for other authenticated UI patterns
            const dashboardContent = await this.page
                .getByText(/create group|your groups|my groups/i)
                .isVisible({timeout: 1000})
                .catch(() => false);

            if (dashboardContent) {
                return true;
            }

            // Default: If no login buttons and no clear auth indicators, assume not logged in for safety
            return false;
        } catch {
            // If we can't determine state, assume not logged in for safety
            return false;
        }
    }

    async isUserAlreadyMember(): Promise<boolean> {
        try {
            return await this.getAlreadyMemberMessage().isVisible({timeout: 2000});
        } catch {
            return false;
        }
    }

    async isJoinPageVisible(): Promise<boolean> {
        try {
            await this.getJoinGroupHeading().waitFor({timeout: 3000});
            return true;
        } catch {
            return false;
        }
    }

    async isErrorPage(): Promise<boolean> {
        try {
            return await this.getErrorMessage().isVisible({timeout: 2000});
        } catch {
            return false;
        }
    }

    async navigateToShareLink(shareLink: string): Promise<void> {
        await this.page.goto(shareLink);
        await this.waitForDomContentLoaded();
        // will either go to login page or join group page
        // will show either join button or "already a member" message
    }

    /**
     * Simply clicks the join group button. Nothing more.
     * All navigation and state checking should be done by the caller.
     */
    private async clickJoinGroup(): Promise<void> {
        const joinButton = this.getJoinGroupButton();
        
        // Make sure button is enabled
        if (!(await joinButton.isEnabled())) {
            throw new Error('Join Group button is disabled');
        }
        
        // Check if button is already in joining state
        const dataJoining = await joinButton.getAttribute('data-joining');
        if (dataJoining === 'true') {
            throw new Error('Join Group button is already in joining state');
        }
        
        // Click the button
        await this.clickButton(joinButton, {buttonName: 'Join Group'});
    }

    /**
     * Comprehensive join flow that handles all authentication states.
     * Throws specific error types based on the failure reason.
     * @param shareLink - The share link to join
     */
    async joinGroupUsingShareLink(shareLink: string): Promise<void> {
        // Navigate to the share link
        await this.navigateToShareLink(shareLink);

        // Wait a bit for page to stabilize
        await this.waitForDomContentLoaded();

        // Check various error conditions
        if (await this.isErrorPage()) {
            throw new Error('Share link is invalid or expired');
        }

        if (await this.isUserAlreadyMember()) {
            // User is already a member - should redirect to group page
            await expect(this.page).toHaveURL(groupDetailUrlPattern(), { timeout: 5000 });
            return; // Success - already a member
        }

        // Wait for join button to be available (don't just check if join page is visible)
        const joinButton = this.getJoinGroupButton();
        try {
            await joinButton.waitFor({ state: 'visible', timeout: 5000 });
        } catch (e) {
            const currentUrl = this.page.url();
            throw new Error(`Join button never appeared. Current URL: ${currentUrl}`);
        }

        // Click the join button
        await this.clickJoinGroup();

        // Wait for the join to complete - several possible outcomes:
        const joinSuccessIndicator = this.page.locator('[data-join-success="true"]');
        const errorMessage = this.page.getByText(/error|failed|try again|something went wrong/i);
        
        // Wait for one of the expected outcomes
        await Promise.race([
            // Success: Welcome screen appears then navigates
            (async () => {
                await expect(joinSuccessIndicator).toBeVisible({ timeout: 10000 });
                await expect(this.page).toHaveURL(groupDetailUrlPattern(), { timeout: 2000 });
            })(),
            
            // Success: Direct navigation to group (fast join)
            expect(this.page).toHaveURL(groupDetailUrlPattern(), { timeout: 10000 }),
            
            // Failure: Error message appears
            (async () => {
                await expect(errorMessage).toBeVisible({ timeout: 10000 });
                const errorText = await errorMessage.textContent();
                throw new Error(`Join failed: ${errorText}`);
            })(),
            
            // Timeout: Button stuck in joining state
            (async () => {
                await this.page.waitForTimeout(10000);
                // Check if button is still showing "Joining..."
                const buttonText = await joinButton.textContent().catch(() => null);
                if (buttonText?.includes('Joining...')) {
                    throw new Error('Join operation timed out - button stuck in joining state');
                }
                throw new Error('Join operation timed out - unknown state');
            })()
        ]).catch(error => {
            // If we got here due to success conditions, check if we're actually on the group page
            const currentUrl = this.page.url();
            if (currentUrl.match(groupDetailUrlPattern())) {
                return; // Success!
            }
            throw error; // Re-throw the actual error
        });
    }

    // Helper for debugging failed joins
    async getPageState(): Promise<{
        url: string;
        title: string;
        isLoggedIn: boolean;
        isAlreadyMember: boolean;
        isErrorPage: boolean;
        isJoinPageVisible: boolean;
        joinButtonVisible: boolean;
        joinButtonEnabled: boolean;
    }> {
        const joinButton = this.getJoinGroupButton();

        return {
            url: this.page.url(),
            title: await this.page.title(),
            isLoggedIn: await this.isUserLoggedIn(),
            isAlreadyMember: await this.isUserAlreadyMember(),
            isErrorPage: await this.isErrorPage(),
            isJoinPageVisible: await this.isJoinPageVisible(),
            joinButtonVisible: await joinButton.isVisible().catch(() => false),
            joinButtonEnabled: await joinButton.isEnabled().catch(() => false),
        };
    }
}
