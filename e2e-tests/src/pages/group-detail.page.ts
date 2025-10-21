import { expect, Locator, Page } from '@playwright/test';
import { GroupDetailPage as BaseGroupDetailPage, HeaderPage, SettlementFormPage as SharedSettlementFormPage } from '@splitifyd/test-support';
import { SettlementFormPage as E2ESettlementFormPage } from './settlement-form.page';
import { GroupId } from '@splitifyd/shared';

export class GroupDetailPage extends BaseGroupDetailPage {
    private _header?: HeaderPage;

    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // E2E-SPECIFIC PROPERTIES AND BASIC UTILITIES
    // ============================================================================

    /**
     * Header property for e2e navigation
     */
    get header(): HeaderPage {
        if (!this._header) {
            this._header = new HeaderPage(this.page);
        }
        return this._header;
    }

    /**
     * Infer group ID from URL (e2e utility)
     */
    inferGroupId(): string {
        const url = new URL(this.page.url());
        const match = url.pathname.match(/\/groups\/([a-zA-Z0-9]+)/);
        if (!match) {
            throw new Error(`Could not infer group ID from URL: ${url.pathname}`);
        }
        return match[1];
    }

    // ============================================================================
    // E2E-SPECIFIC GETTERS AND FORM OPENING METHODS
    // ============================================================================

    /**
     * Click Settle Up button and open settlement form (e2e-specific workflow)
     * This is an e2e version that returns the extended SettlementFormPage instead of void
     */
    async clickSettleUpButton(expectedMemberCount: number): Promise<E2ESettlementFormPage> {
        // Assert we're on the group detail page before action
        await expect(this.page).toHaveURL(groupDetailUrlPattern());

        // Get button and click it (clickButton will handle attachment wait internally)
        const settleButton = this.getSettleUpButton();

        await this.clickButton(settleButton, { buttonName: 'Settle up' });

        // Verify modal opened
        const settlementFormPage = new E2ESettlementFormPage(this.page);
        await expect(settlementFormPage.getModal()).toBeVisible();

        const membersCount = await this.getCurrentMemberCount();
        expect(membersCount).toBe(expectedMemberCount);

        await settlementFormPage.waitForFormReady(expectedMemberCount);
        return settlementFormPage;
    }

    // ============================================================================
    // POLLING AND WAITING METHODS (Real-time update verification)
    // ============================================================================

    /**
     * Wait for group title to update (e2e-specific polling for real-time updates)
     */
    async waitForGroupTitle(text: string) {
        await this.waitForDomContentLoaded();

        // Use polling pattern to handle async updates (since no real-time websockets yet)
        await expect(async () => {
            const title = await this.getGroupName().textContent();
            if (title !== text) {
                throw new Error(`Title is still "${title}", waiting for "${text}"`);
            }
        })
            .toPass({
                timeout: 5000,
                intervals: [500, 1000, 1500, 2000], // Retry at these intervals
            });
    }

    /**
     * Wait for group description to update (e2e-specific polling for real-time updates)
     */
    async waitForGroupDescription(text: string) {
        await this.waitForDomContentLoaded();

        // Use polling pattern to handle async updates (since no real-time websockets yet)
        await expect(async () => {
            const description = await this.getGroupDescription().textContent();
            if (description !== text) {
                throw new Error(`Description is still "${description}", waiting for "${text}"`);
            }
        })
            .toPass({
                timeout: 5000,
                intervals: [500, 1000, 1500, 2000], // Retry at these intervals
            });
    }

    async waitForPage(groupId: GroupId, expectedMemberCount: number) {
        const targetGroupUrl = `/groups/${groupId}`;
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);

        await this.header.getCurrentUserDisplayName(); // just a sanity check - top right by the menu

        await this.waitForMemberCount(expectedMemberCount);
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);
        await this.waitForBalancesSection(groupId);
        await this.sanityCheckPageUrl(this.page.url(), targetGroupUrl);
    }

    private async sanityCheckPageUrl(currentUrl: string, targetGroupUrl: string) {
        // Assert we're actually on the group page
        if (!currentUrl.includes(targetGroupUrl)) {
            // Take screenshot before throwing error
            throw new Error(`Navigation failed. Expected URL to contain ${targetGroupUrl}, but got: ${currentUrl}`);
        }
    }

    // ============================================================================
    // EXPENSE METHODS
    // ============================================================================

    /**
     * Verify that a currency amount is visible for a specific user within the expenses section
     * Properly scoped to the Expenses container by its heading
     * @param payer - The display name of the user who paid (e.g., 'pool user 6dbee5f4')
     * @param currencyAmount - The formatted currency amount to find (e.g., '¥123', 'BHD 30.500', 'EUR 50.00')
     */
    // ============================================================================
    // MEMBER COUNT AND ITEMS
    // ============================================================================

    // ============================================================================
    // SETTLEMENT HISTORY METHODS (Payment History Section)
    // ============================================================================

    /**
     * Click edit button for a settlement and wait for edit form to open
     */
    override async clickEditSettlement<T extends SharedSettlementFormPage = SharedSettlementFormPage>(
        settlementNote: string | RegExp,
        options: {
            createSettlementFormPage?: (page: Page) => T;
            expectedMemberCount?: number;
            waitForFormReady?: boolean;
            ensureUpdateHeading?: boolean;
        } = {},
    ): Promise<T> {
        const createSettlementFormPage =
            options.createSettlementFormPage
            ?? ((page: Page) => new E2ESettlementFormPage(page) as unknown as T);

        return super.clickEditSettlement<T>(settlementNote, {
            ...options,
            createSettlementFormPage,
            waitForFormReady: options.waitForFormReady ?? true,
        });
    }

    /**
     * Legacy alias retained for existing test call sites.
     */
    async openHistoryIfClosed(): Promise<void> {
        await this.ensureSettlementHistoryOpen();
    }

    async waitForRedirectAwayFromGroup(groupId: GroupId): Promise<void> {
        // Use proper web-first assertion to wait for URL change
        await expect(this.page).not.toHaveURL(new RegExp(`/groups/${groupId}`), { timeout: 5000 });
    }

}

/**
 * Helper to build a group detail URL pattern
 */
export function groupDetailUrlPattern(groupId?: string): RegExp {
    if (groupId) {
        return new RegExp(`/groups/${groupId}$`);
    }
    return /\/groups\/[a-zA-Z0-9]+$/;
}
