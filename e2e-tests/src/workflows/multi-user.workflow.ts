import { Page, expect } from '@playwright/test';
import { GroupDetailPage, JoinGroupPage } from '../pages';
import { groupDetailUrlPattern } from '../pages/group-detail.page.ts';

/**
 * @deprecated i don't like this pattern
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
