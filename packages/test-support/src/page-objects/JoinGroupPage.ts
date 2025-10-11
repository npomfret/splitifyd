import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';
import { HeaderPage } from './HeaderPage';
import { loadTranslation } from './translation-loader';

const translation = loadTranslation();

/**
 * Page Object Model for join group functionality via share links.
 * Handles different authentication states and provides robust join operations.
 * Reusable across unit tests and e2e tests.
 */
export class JoinGroupPage extends BasePage {
    private _header?: HeaderPage;

    constructor(page: Page) {
        super(page);
    }

    private get header(): HeaderPage {
        if (!this._header) {
            this._header = new HeaderPage(this.page);
        }
        return this._header;
    }

    // ============================================================================
    // STATIC UTILITY METHODS
    // ============================================================================

    /**
     * Helper to build a group detail URL pattern
     * Use for URL matching in tests and navigation verification
     */
    static groupDetailUrlPattern(groupId?: string): RegExp {
        if (groupId) {
            return new RegExp(`/groups/${groupId}$`);
        }
        return /\/groups\/[a-zA-Z0-9]+/;
    }

    // ============================================================================
    // ELEMENT SELECTORS - Scoped to join group page
    // ============================================================================

    getJoinGroupHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.joinGroupPage.title });
    }

    /**
     * Get the group name heading displayed in the group preview card.
     * The group name appears as a level 2 heading.
     */
    getGroupNameHeading(): Locator {
        return this.page.getByRole('heading', { level: 2 });
    }

    getJoinGroupButton(): Locator {
        return this.page.getByRole('button', { name: translation.joinGroupPage.joinGroup });
    }

    getAlreadyMemberMessage(): Locator {
        return this.page.getByText(translation.joinGroupPage.alreadyMember);
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

    getBackToDashboardButton(): Locator {
        return this.page.getByRole('button', { name: /Go to dashboard/i });
    }

    getOkButton(): Locator {
        return this.page.getByRole('button', { name: translation.joinGroupPage.goToGroup });
    }

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Get the text content of the group name heading.
     * @returns Promise resolving to the group name as a string
     */
    async getGroupName(): Promise<string> {
        const heading = this.getGroupNameHeading();
        await expect(heading).toBeVisible();
        const text = await heading.textContent();
        if (!text) {
            throw new Error('Group name heading is empty');
        }
        return text.trim();
    }

    /**
     * Check if user is logged in by examining page elements
     */
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
            const joinButtonVisible = await this.getJoinGroupButton().isVisible({ timeout: 1000 }).catch(() => false);
            const joinGroupHeadingVisible = await this.getJoinGroupHeading().isVisible({ timeout: 1000 }).catch(() => false);
            const groupInviteMessage = await this.page
                .getByText(/you've been invited|invited to join/i)
                .isVisible({ timeout: 1000 })
                .catch(() => false);

            if (joinButtonVisible || joinGroupHeadingVisible || groupInviteMessage) {
                return true;
            }

            // Then check: Look for login/register UI elements (reliable indicator for other pages)
            const loginVisible = await this.getLoginButton().isVisible({ timeout: 1000 }).catch(() => false);
            const registerVisible = await this.getRegisterButton().isVisible({ timeout: 1000 }).catch(() => false);

            // If we see login/register buttons, user is definitely not logged in
            if (loginVisible || registerVisible) {
                return false;
            }

            // Look for user-specific UI elements that indicate login
            const userMenuVisible = await this.header.getUserMenuButton().isVisible({ timeout: 1000 }).catch(() => false);

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

    // ============================================================================
    // ACTION METHODS - Non-fluent versions (action only)
    // ============================================================================

    /**
     * Navigate to a share link
     * Non-fluent version - navigates without verification
     */
    async navigateToShareLink(shareLink: string): Promise<void> {
        await this.page.goto(shareLink);
        await this.waitForDomContentLoaded();
        // will either go to login page or join group page
        // will show either join button or "already a member" message
    }

    /**
     * Click the join group button
     * Non-fluent version - clicks without verification
     * Private method - use public methods for reliable join flows
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
     * Click the OK/Go to Group button after successful join
     * Non-fluent version - clicks without navigation verification
     */
    async clickOkButton(): Promise<void> {
        const okButton = this.getOkButton();
        await this.clickButton(okButton, { buttonName: 'OK/Go to Group' });
    }

    // ============================================================================
    // ACTION METHODS - Fluent versions (action + verification)
    // ============================================================================

    /**
     * Join group using share link
     * Fluent version - complete join flow with verification
     * Throws specific error types based on the failure reason
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

    /**
     * Click join button and wait for join to complete
     * Fluent version - verifies navigation to group page or success screen
     */
    async clickJoinGroupAndWaitForJoin(): Promise<void> {
        await this.clickJoinGroup();

        // Wait for join to complete using single polling loop
        await expect(async () => {
            const currentUrl = this.page.url();
            const isOnGroupPage = currentUrl.match(JoinGroupPage.groupDetailUrlPattern());
            const hasError = await this.getErrorMessage().isVisible().catch(() => false);
            const hasSuccessScreen = await this.page.locator('[data-join-success="true"]').isVisible().catch(() => false);

            if (isOnGroupPage) {
                return; // Success - direct navigation
            }

            if (hasError) {
                const errorText = await this.getErrorMessage().textContent();
                throw new Error(`Join failed: ${errorText}`);
            }

            if (hasSuccessScreen) {
                await this.clickOkButton();
                await expect(this.page).toHaveURL(JoinGroupPage.groupDetailUrlPattern(), { timeout: TEST_TIMEOUTS.NAVIGATION });
                return; // Success - via success screen
            }

            // Still joining - keep polling
            throw new Error('Still joining...');
        }).toPass({ timeout: 5000 });
    }

    // ============================================================================
    // VERIFICATION METHODS - For test verification
    // ============================================================================

    /**
     * Verify join button is not visible (user already a member)
     */
    async verifyJoinGroupButtonNotVisible(): Promise<void> {
        const joinButton = this.getJoinGroupButton();
        await expect(joinButton).not.toBeVisible();
    }

    /**
     * Verify "already a member" message is displayed
     */
    async verifyAlreadyMemberMessageVisible(): Promise<void> {
        const alreadyMemberMessage = this.getAlreadyMemberMessage();
        await expect(alreadyMemberMessage).toBeVisible();
    }
}
