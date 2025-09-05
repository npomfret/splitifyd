import { Page } from '@playwright/test';
import { DashboardPage, GroupDetailPage } from '../pages';
import { GroupWorkflow } from '../workflows';
import { generateTestGroupName } from '../../../packages/test-support/test-helpers';

interface GroupOptions {
    fresh?: boolean;
    description?: string;
    memberCount?: number;
}

interface GroupCacheKey {
    userEmail: string;
    memberCount: number;
}

/**
 * E2E Test group manager that provides cached group access for improved test performance.
 * Similar to Firebase TestGroupManager but designed for E2E browser automation.
 */
export class TestGroupWorkflow {
    private static groupCache: Map<string, Promise<string>> = new Map();

    private static createCacheKey(userEmail: string, memberCount: number = 1): string {
        return `${userEmail}:${memberCount}`;
    }

    /**
     * Get or create a group for E2E testing, with caching to improve performance
     */
    public static async getOrCreateGroup(
        page: Page,
        userEmail: string,
        options: GroupOptions = {}
    ): Promise<string> {
        const { fresh = false, description, memberCount = 1 } = options;
        
        if (fresh) {
            return this.createFreshGroup(page, description);
        }

        const cacheKey = this.createCacheKey(userEmail, memberCount);

        if (!this.groupCache.has(cacheKey)) {
            const groupPromise = this.createFreshGroup(page, description);
            this.groupCache.set(cacheKey, groupPromise);
        }

        return this.groupCache.get(cacheKey)!;
    }

    /**
     * Try to reuse an existing group from the dashboard, or create a new one
     */
    public static async getOrCreateGroupSmarter(
        page: Page,
        userEmail: string,
        options: GroupOptions = {}
    ): Promise<string> {
        const { fresh = false, description, memberCount = 1 } = options;
        
        if (fresh) {
            return this.createFreshGroup(page, description);
        }

        const cacheKey = this.createCacheKey(userEmail, memberCount);

        if (!this.groupCache.has(cacheKey)) {
            // Try to find existing group first
            const existingGroupId = await this.tryToFindExistingGroup(page);
            if (existingGroupId) {
                const groupPromise = Promise.resolve(existingGroupId);
                this.groupCache.set(cacheKey, groupPromise);
                return existingGroupId;
            }

            // No existing group found, create new one
            const groupPromise = this.createFreshGroup(page, description);
            this.groupCache.set(cacheKey, groupPromise);
        }

        const groupId = await this.groupCache.get(cacheKey)!;
        
        // Ensure we're actually on the group page
        await this.ensureNavigatedToGroup(page, groupId);
        
        return groupId;
    }

    /**
     * Attempt to find and click on an existing group from the dashboard
     */
    private static async tryToFindExistingGroup(page: Page): Promise<string | null> {
        try {
            const dashboard = new DashboardPage(page);
            
            // Navigate to dashboard if not already there
            const currentUrl = page.url();
            if (!currentUrl.includes('/dashboard')) {
                await dashboard.navigate();
                await dashboard.waitForDashboard();
            }

            // Look for any existing group cards
            const groupCards = page.locator('[data-testid="group-card"]');
            const groupCount = await groupCards.count();
            
            if (groupCount > 0) {
                // Click on the first available group
                await groupCards.first().click();
                
                // Wait for navigation to group detail page
                await page.waitForURL(/\/groups\/[^\/]+/);
                
                // Extract group ID from URL
                const url = page.url();
                const match = url.match(/\/groups\/([^\/]+)/);
                if (match) {
                    const groupId = match[1];
                    
                    // Verify we're on a valid group page
                    const groupDetailPage = new GroupDetailPage(page);
                    await groupDetailPage.waitForBalancesToLoad(groupId);
                    
                    return groupId;
                }
            }
            
            return null;
        } catch (error) {
            // If anything goes wrong, fall back to creating a new group
            console.debug('Could not find existing group, will create new one:', error);
            return null;
        }
    }

    /**
     * Ensure the page is navigated to the correct group page
     */
    private static async ensureNavigatedToGroup(page: Page, groupId: string): Promise<void> {
        const currentUrl = page.url();
        
        // If already on the correct group page, nothing to do
        if (currentUrl.includes(`/groups/${groupId}`)) {
            return;
        }
        
        // Navigate to the group page
        await page.goto(`/groups/${groupId}`);
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        
        // Verify navigation succeeded
        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.waitForBalancesToLoad(groupId);
    }

    private static async createFreshGroup(page: Page, description?: string): Promise<string> {
        const groupName = generateTestGroupName('E2E');
        const groupDescription = description || `E2E Test Group for automated testing`;

        const groupWorkflow = new GroupWorkflow(page);
        return groupWorkflow.createGroupAndNavigate(groupName, groupDescription);
    }
}