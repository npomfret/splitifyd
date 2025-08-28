import { Page, expect } from '@playwright/test';
import { GroupDetailPage, JoinGroupPage } from '../pages';
import { groupDetailUrlPattern } from '../pages/group-detail.page.ts';

/**
 * Multi-user workflow class that handles complex multi-user test scenarios.
 * Encapsulates the creation of multiple users, groups, and collaborative operations.
 */
export class MultiUserWorkflow {
    constructor() {}

    /**
     * Reliably gets the share link from the group page.
     * Uses the optimized GroupDetailPage method with fast timeouts.
     */
    async getShareLink(page: Page): Promise<string> {
        const groupDetailPage = new GroupDetailPage(page);
        return await groupDetailPage.getShareLink();
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
        await expect(page).toHaveURL(groupDetailUrlPattern());

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
