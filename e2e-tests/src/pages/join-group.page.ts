import { Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { TIMEOUT_CONTEXTS } from '../config/timeouts';
import { NavigationResult } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { JoinGroupError, AuthenticationError, NavigationError } from '../errors/test-errors';

/**
 * Page object for join group functionality via share links.
 * Handles different authentication states and provides robust join operations.
 */
export class JoinGroupPage extends BasePage {
    // Core selectors with retry logic
    getJoinGroupHeading(): Locator {
        return this.page.getByRole('heading', { name: /join group/i });
    }

    getJoinGroupButton(): Locator {
        return this.page.getByRole('button', { name: /join group/i });
    }

    getAlreadyMemberMessage(): Locator {
        return this.page.getByText(/already.*member|you.*already.*part/i);
    }

    getGroupNameHeading(): Locator {
        return this.page.getByRole('heading').first();
    }

    getLoginButton(): Locator {
        return this.page.getByRole('button', { name: /login|sign in/i });
    }

    getRegisterButton(): Locator {
        return this.page.getByRole('button', { name: /register|sign up/i });
    }

    getErrorMessage(): Locator {
        return this.page.getByText(/error|not found|invalid/i);
    }

    getSpecificErrorMessage(pattern: string | RegExp): Locator {
        return this.page.getByText(pattern);
    }

    getBackToDashboardButton(): Locator {
        return this.page.getByRole('button', { name: /back to dashboard/i });
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
                await this.page.waitForLoadState('domcontentloaded');
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
            const userMenuVisible = await this.page
                .locator('[data-testid="user-menu-button"]')
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

    // Navigation and join operations
    async navigateToShareLink(shareLink: string): Promise<void> {
        await this.page.goto(shareLink);
        await this.page.waitForLoadState('domcontentloaded');

        // Wait for either login redirect or join page elements to appear
        try {
            await Promise.race([
                this.page.waitForURL(/\/login/, { timeout: 2000 }),
                this.getJoinGroupHeading().waitFor({ state: 'visible', timeout: 2000 }),
                this.getJoinGroupButton().waitFor({ state: 'visible', timeout: 2000 }),
            ]);
        } catch {
            // If none of the expected elements appear, continue anyway
        }
    }

    /**
     * Attempts to join group with comprehensive error handling and retry logic.
     * Handles different authentication states automatically.
     */
    async joinGroup(
        options: {
            maxRetries?: number;
            expectedRedirectPattern?: RegExp;
            skipRedirectWait?: boolean;
        } = {},
    ): Promise<void> {
        const { maxRetries = 3, expectedRedirectPattern = /\/groups\/[a-zA-Z0-9]+$/, skipRedirectWait = false } = options;

        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Wait for page to be ready
                await this.page.waitForLoadState('domcontentloaded');

                // Check if user is already a member
                if (await this.isUserAlreadyMember()) {
                    throw new Error('User is already a member of this group');
                }

                // Check if this is an error page
                if (await this.isErrorPage()) {
                    throw new Error('Share link is invalid or group not found');
                }

                // Check if user needs to log in first
                if (!(await this.isUserLoggedIn())) {
                    throw new Error('User must be logged in to join group');
                }

                // Wait for join button to be available
                const joinButton = this.getJoinGroupButton();
                await joinButton.waitFor({ state: 'visible', timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
                await joinButton.waitFor({ state: 'attached', timeout: 1000 });

                // Click the join button using standardized method
                await this.clickButton(joinButton, { buttonName: 'Join Group' });

                // Wait for redirect unless skipped
                if (!skipRedirectWait) {
                    await this.page.waitForURL(expectedRedirectPattern, {
                        timeout: TIMEOUT_CONTEXTS.GROUP_CREATION,
                    });
                }

                // Success - exit retry loop
                return;
            } catch (error) {
                lastError = error as Error;

                if (attempt < maxRetries) {
                    // Wait progressively longer between retries
                    await this.page.waitForLoadState('domcontentloaded');

                    // Wait for state synchronization instead of reload
                    await this.waitForNetworkIdle();
                }
            }
        }

        // All retries failed
        throw new Error(`Failed to join group after ${maxRetries} attempts. Last error: ${lastError?.message}`);
    }

    /**
     * Comprehensive join flow that handles all authentication states.
     * Throws specific error types based on the failure reason.
     * @param shareLink - The share link to join
     * @param userInfo - Optional user info for debugging (e.g., {displayName: 'User Name', email: 'user@example.com'})
     */
    async attemptJoinWithStateDetection(
        shareLink: string,
        userInfo?: { displayName?: string; email?: string },
    ): Promise<void> {
        // Log the attempt for debugging
        const timestamp = new Date().toISOString();

        await this.navigateToShareLink(shareLink);

        // Wait for any redirects to complete
        await this.page.waitForLoadState('domcontentloaded');

        // Wait for either login page or join page to appear
        try {
            await this.page.waitForFunction(
                () => {
                    return window.location.href.includes('/login') || window.location.href.includes('/join') || document.querySelector('[data-testid="join-group-heading"]') !== null;
                },
                { timeout: 3000 },
            );
        } catch {
            // Continue if timeout - will be handled by URL check below
        }

        // Check if we've been redirected to login page
        const currentUrl = this.page.url();
        if (currentUrl.includes('/login')) {
            const pageState = await this.getPageState();

            throw new AuthenticationError(
                'User redirected to login',
                'Join group via share link',
                {
                    success: false,
                    reason: 'User redirected to login',
                    currentUrl,
                    userInfo,
                    timestamp,
                    pageState,
                    authState: 'not_authenticated',
                    needsLogin: true
                }
            );
        }

        // Check various states
        const alreadyMember = await this.isUserAlreadyMember();
        const error = await this.isErrorPage();
        const joinPageVisible = await this.isJoinPageVisible();

        // IMPORTANT: If the join page is visible, the user MUST be logged in
        // The join page with button only appears for authenticated users
        // We check this BEFORE isUserLoggedIn() to avoid false negatives

        if (error) {
            const pageState = await this.getPageState();

            throw new JoinGroupError(
                'Invalid share link or group not found',
                'Join group via share link',
                {
                    success: false,
                    reason: 'Invalid share link or group not found',
                    currentUrl,
                    userInfo,
                    timestamp,
                    pageState,
                    shareLink,
                    needsLogin: false,
                    alreadyMember: false,
                    error: true
                }
            );
        }

        if (alreadyMember) {
            const pageState = await this.getPageState();

            throw new JoinGroupError(
                'User is already a member of this group',
                'Join group via share link',
                {
                    success: false,
                    reason: 'User is already a member of this group',
                    currentUrl,
                    userInfo,
                    timestamp,
                    pageState,
                    shareLink,
                    needsLogin: false,
                    alreadyMember: true
                }
            );
        }

        // If join page is visible, user is definitely logged in - proceed to join
        if (joinPageVisible) {
            // Try to join the group
            try {
                await this.joinGroup({ skipRedirectWait: false });
                const pageState = await this.getPageState();
                // Success - method returns normally
                return;
            } catch (error) {
                const pageState = await this.getPageState();

                throw new JoinGroupError(
                    `Failed to join group: ${error}`,
                    'Join group via share link',
                    {
                        success: false,
                        reason: `Failed to join group: ${error}`,
                        currentUrl,
                        userInfo,
                        timestamp,
                        pageState,
                        shareLink,
                        needsLogin: false,
                        alreadyMember: false,
                        originalError: String(error)
                    }
                );
            }
        }

        // Only check login status if join page is NOT visible
        // This prevents false negatives when the user is actually logged in
        const needsLogin = !(await this.isUserLoggedIn());

        if (needsLogin) {
            const pageState = await this.getPageState();

            throw new AuthenticationError(
                'User needs to log in first',
                'Join group via share link',
                {
                    success: false,
                    reason: 'User needs to log in first',
                    currentUrl,
                    userInfo,
                    timestamp,
                    pageState,
                    authState: 'not_authenticated',
                    needsLogin: true
                }
            );
        }

        // If we get here, something unexpected happened
        const pageState = await this.getPageState();

        throw new NavigationError(
            'Join group page not visible - unexpected state',
            'Join group via share link',
            {
                success: false,
                reason: 'Join group page not visible - unexpected state',
                currentUrl,
                userInfo,
                timestamp,
                pageState,
                shareLink,
                error: true
            }
        );
    }
    
    /**
     * Join group with error throwing instead of result objects.
     * Simply delegates to attemptJoinWithStateDetection which now throws directly.
     */
    async joinGroupOrThrow(
        shareLink: string,
        userInfo?: { displayName?: string; email?: string }
    ): Promise<void> {
        // attemptJoinWithStateDetection now throws directly instead of returning a result
        await this.attemptJoinWithStateDetection(shareLink, userInfo);
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
