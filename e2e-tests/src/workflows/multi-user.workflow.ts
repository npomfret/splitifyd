import { Page } from '@playwright/test';
import { GroupDetailPage, DashboardPage, JoinGroupPage, LoginPage } from '../pages';
import { TIMEOUT_CONTEXTS } from '../config/timeouts';
import type { User as BaseUser } from '@shared/shared-types';

/**
 * Multi-user workflow class that handles complex multi-user test scenarios.
 * Encapsulates the creation of multiple users, groups, and collaborative operations.
 */
export class MultiUserWorkflow {
    private users: Array<{ page: Page; user: BaseUser }> = [];
    private groupId?: string;
    private expenses: Array<{ description: string; amount: number; paidBy: string }> = [];
    private shareLink?: string;

    constructor(private browser: any) {}

    /**
     * Reliably gets the share link from the group page.
     * Uses the optimized GroupDetailPage method with fast timeouts.
     */
    async getShareLink(page: Page): Promise<string> {
        const groupDetailPage = new GroupDetailPage(page);
        return await groupDetailPage.getShareLink();
    }

    /**
     * Joins a group via share link with comprehensive error handling.
     * Handles different authentication states automatically.
     */
    async joinGroupViaShareLink(page: Page, shareLink: string, user?: BaseUser): Promise<void> {
        const joinGroupPage = new JoinGroupPage(page);

        try {
            // Attempt join with state detection
            const result = await joinGroupPage.attemptJoinWithStateDetection(shareLink);

            if (result.success) {
                // Wait for group page to load completely
                await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
                await page.waitForLoadState('domcontentloaded');
                return;
            }

            // Handle different failure scenarios
            if (result.needsLogin) {
                throw new Error(`Join group failed ${JSON.stringify(result)}`);
            }

            if (result.alreadyMember) {
                // User is already a member - this might be expected in some tests
                console.warn(`User ${user?.displayName || 'unknown'} is already a member of the group`);
                return;
            }

            if (result.error) {
                throw new Error(`User ${user?.displayName || 'unknown'} (${user?.email || 'unknown'}) failed to join group: ${result.reason}`);
            }

            throw new Error(`Unexpected join result: ${result.reason}`);
        } catch (error) {
            // Take debug screenshot
            await joinGroupPage.takeDebugScreenshot(`failed-join-${user?.displayName || 'user'}`);

            // Get detailed page state for debugging
            const pageState = await joinGroupPage.getPageState();

            throw new Error(`Failed to join group via share link: ${error}. Page state: ${JSON.stringify(pageState, null, 2)}`);
        }
    }

    /**
     * Joins a group via share link when user is not logged in.
     * Handles login flow first, then joins the group.
     */
    async joinGroupViaShareLinkWithLogin(page: Page, shareLink: string, user: BaseUser): Promise<void> {
        const joinGroupPage = new JoinGroupPage(page);

        // Navigate to share link first
        await joinGroupPage.navigateToShareLink(shareLink);

        // Check if login is needed
        const isLoggedIn = await joinGroupPage.isUserLoggedIn();

        if (!isLoggedIn) {
            // Store the original share link URL
            const shareUrl = page.url();

            // Check if we have a login button on the join page
            const loginButton = joinGroupPage.getLoginButton();
            if (await loginButton.isVisible()) {
                // Click the login button on the join page
                await loginButton.click();
                await page.waitForLoadState('domcontentloaded');
            } else {
                // Navigate to login page directly
                const loginPage = new LoginPage(page);
                await loginPage.navigate();
            }

            // Perform login
            const loginPage = new LoginPage(page);
            const password = 'TestPassword123!'; // Standard test password
            await loginPage.login(user.email, password);

            // After login, wait for redirect to complete
            await page.waitForLoadState('domcontentloaded');

            // Check where we ended up
            const currentUrl = page.url();
            if (!currentUrl.includes('/join')) {
                // We weren't redirected to join page, navigate back to share link
                await page.goto(shareUrl);
                await page.waitForLoadState('domcontentloaded');
            }
        }

        // Now attempt to join
        await joinGroupPage.joinGroup();

        // Wait for redirect to group page
        await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
        await page.waitForLoadState('domcontentloaded');
    }

    /**
     * Tests share link with user who is already a member.
     * Verifies user is redirected to the group page.
     */
    async testShareLinkAlreadyMember(page: Page, shareLink: string): Promise<void> {
        const joinGroupPage = new JoinGroupPage(page);

        // Navigate to share link
        await joinGroupPage.navigateToShareLink(shareLink);

        // Should redirect to group page since user is already a member
        await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 5000 });

        // Verify we're on the group page (not the join page)
        const isOnGroupPage = page.url().includes('/groups/') && !page.url().includes('/join');
        if (!isOnGroupPage) {
            throw new Error(`Expected redirect to group page for already-member, but stayed on: ${page.url()}`);
        }
    }

    /**
     * Tests an invalid share link.
     * Verifies appropriate error is shown.
     */
    async testInvalidShareLink(page: Page, invalidShareLink: string): Promise<void> {
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

        // Either error page is shown OR join page without join button - both are acceptable
    }
}
