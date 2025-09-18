import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { PooledTestUser } from '@splitifyd/shared';
import { GroupDetailPage, groupDetailUrlPattern } from './group-detail.page.ts';
import translationEn from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

/**
 * Page object for join group functionality via share links.
 * Handles different authentication states and provides robust join operations.
 */
export class JoinGroupPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }

    static async joinGroupViaShareLink(page: Page, shareLink: string, groupId?: string) {
        const joinGroupPage = new JoinGroupPage(page);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        return new GroupDetailPage(page);
    }

    static async attemptToJoinWithInvalidShareLink(page: Page, invalidShareLink: string): Promise<void> {
        const joinGroupPage = new JoinGroupPage(page);

        // Navigate to invalid share link
        await joinGroupPage.navigateToShareLink(invalidShareLink);

        // Should show error page OR join page without join button (both are valid error states)
        const pageState = await joinGroupPage.getPageState();
        const isErrorPage = await joinGroupPage.isErrorPage();
        const joinButtonVisible = pageState.joinButtonVisible;

        if (!isErrorPage && joinButtonVisible) {
            // If no error message and join button is visible, that's unexpected
            throw new Error(`Expected error page or disabled join but found active join page. Page state: ${JSON.stringify(pageState, null, 2)}`);
        }
    }

    getJoinGroupHeading(): Locator {
        return this.page.getByRole('heading', { name: translationEn.joinGroupPage.title });
    }

    getJoinGroupButton(): Locator {
        return this.page.getByRole('button', { name: translationEn.joinGroupPage.joinGroup });
    }

    getAlreadyMemberMessage(): Locator {
        return this.page.getByText(translationEn.joinGroupPage.alreadyMember);
    }

    getLoginButton(): Locator {
        return this.page.getByRole('button', { name: /login|sign in/i });
    }

    getRegisterButton(): Locator {
        return this.page.getByRole('button', { name: /register|sign up/i });
    }

    getErrorMessage(): Locator {
        return this.page.locator('[data-testid="invalid-link-warning"], [data-testid="unable-join-warning"], [role="alert"]');
    }

    getSpecificErrorMessage(pattern: string | RegExp): Locator {
        return this.page.getByText(pattern);
    }

    getBackToDashboardButton(): Locator {
        return this.page.getByRole('button', { name: /Go to dashboard/i });
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
                .isVisible({ timeout: 500 })
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
                .isVisible({ timeout: 1000 })
                .catch(() => false);
            const joinGroupHeadingVisible = await this.getJoinGroupHeading()
                .isVisible({ timeout: 1000 })
                .catch(() => false);
            const groupInviteMessage = await this.page
                .getByText(/you've been invited|invited to join/i)
                .isVisible({ timeout: 1000 })
                .catch(() => false);

            if (joinButtonVisible || joinGroupHeadingVisible || groupInviteMessage) {
                return true;
            }

            // Then check: Look for login/register UI elements (reliable indicator for other pages)
            const loginVisible = await this.getLoginButton()
                .isVisible({ timeout: 1000 })
                .catch(() => false);
            const registerVisible = await this.getRegisterButton()
                .isVisible({ timeout: 1000 })
                .catch(() => false);

            // If we see login/register buttons, user is definitely not logged in
            if (loginVisible || registerVisible) {
                return false;
            }

            // Look for user-specific UI elements that indicate login
            const userMenuVisible = await this.header.getUserMenuButton()
                .isVisible({ timeout: 1000 })
                .catch(() => false);

            // If we see user menu, definitely logged in
            if (userMenuVisible) {
                return true;
            }

            // Final check: Look for other authenticated UI patterns
            const dashboardContent = await this.page
                .getByText(/create group|your groups|my groups/i)
                .isVisible({ timeout: 1000 })
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
            return await this.getAlreadyMemberMessage().isVisible({ timeout: 2000 });
        } catch {
            return false;
        }
    }

    async isJoinPageVisible(): Promise<boolean> {
        try {
            await this.getJoinGroupHeading().waitFor({ timeout: 3000 });
            return true;
        } catch {
            return false;
        }
    }

    async isErrorPage(): Promise<boolean> {
        try {
            return await this.getErrorMessage().isVisible({ timeout: 2000 });
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
        await this.clickButton(joinButton, { buttonName: 'Join Group' });
    }

    /**
     * Comprehensive join flow that handles all authentication states.
     * Throws specific error types based on the failure reason.
     * @param shareLink - The share link to join
     */
    async joinGroupUsingShareLink(shareLink: string): Promise<void> {
        // Navigate to the share link
        await this.navigateToShareLink(shareLink);

        await expect(this.getJoinGroupHeading()).toBeVisible();

        // Wait a bit for page to stabilize
        await this.waitForDomContentLoaded();

        // Check various error conditions
        if (await this.isErrorPage()) {
            throw new Error('Share link is invalid or expired');
        }

        await this.clickJoinGroupAndWaitForJoin();
    }

    async assertJoinGroupButtonIsMissing() {
        const joinButton = this.getJoinGroupButton();
        await expect(joinButton).not.toBeVisible();
    }

    async assertAlreadyMemberTextIsVisible() {
        const alreadyMemberMessage = this.getAlreadyMemberMessage();
        await expect(alreadyMemberMessage).toBeVisible();
    }

    getOkButton(): Locator {
        return this.page.getByRole('button', { name: translationEn.joinGroupPage.goToGroup });
    }

    async clickOkButton(): Promise<void> {
        const okButton = this.getOkButton();
        await this.clickButton(okButton, { buttonName: 'OK/Go to Group' });
    }

    async clickJoinGroupAndWaitForJoin() {
        // Wait for join button to be available (don't just check if join page is visible)
        const joinButton = this.getJoinGroupButton();

        await this.clickJoinGroup();

        // Wait for the join to complete - several possible outcomes:
        const joinSuccessIndicator = this.page.locator('[data-join-success="true"]');
        // More specific error selectors to avoid false positives from group descriptions
        const errorMessage = this.page.locator('[data-testid="invalid-link-warning"], [data-testid="unable-join-warning"], [role="alert"]');

        // Wait for one of the expected outcomes
        await Promise.race([
            // Success: Welcome screen appears then navigates
            (async () => {
                await expect(joinSuccessIndicator).toBeVisible({ timeout: 5000 });
                await expect(this.page).toHaveURL(groupDetailUrlPattern(), { timeout: 2000 });
            })(),

            // Success: Direct navigation to group (fast join)
            expect(this.page).toHaveURL(groupDetailUrlPattern(), { timeout: 5000 }),

            // Failure: Error message appears
            (async () => {
                await expect(errorMessage).toBeVisible({ timeout: 5000 });
                const errorText = await errorMessage.textContent();
                throw new Error(`Join failed: ${errorText}`);
            })(),

            // Timeout: Button stuck in joining state - use polling instead of fixed timeout
            (async () => {
                await expect(async () => {
                    // Check if button is still showing "Joining..."
                    const buttonText = await joinButton.textContent().catch(() => null);
                    if (buttonText?.includes('Joining...')) {
                        throw new Error('Button still stuck in joining state');
                    }
                    // If button text has changed, check for other completion indicators
                    const currentUrl = this.page.url();
                    const isOnGroupPage = currentUrl.match(groupDetailUrlPattern());
                    const hasError = await errorMessage.isVisible().catch(() => false);
                    const hasSuccess = await joinSuccessIndicator.isVisible().catch(() => false);

                    if (!isOnGroupPage && !hasError && !hasSuccess) {
                        throw new Error('Join operation in unknown state - no completion indicators found');
                    }
                    // If we reach here, one of the expected outcomes occurred
                }).toPass({ timeout: 5000 });

                // Final state check
                const currentUrl = this.page.url();
                if (!currentUrl.match(groupDetailUrlPattern())) {
                    throw new Error('Join operation completed but not on group page');
                }
            })(),
        ]).catch((error) => {
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
