import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { TenantEditorModalPage } from './TenantEditorModalPage';

/**
 * Page Object Model for the Admin Tenants page.
 * Provides methods for viewing and managing all tenant configurations (system admin only).
 */
export class AdminTenantsPage extends BasePage {
    readonly url = '/admin/tenants';

    constructor(page: Page) {
        super(page);
    }

    /**
     * Navigate to admin tenants page
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });

        // Check if we successfully navigated
        try {
            await expect(this.page).toHaveURL(/\/admin\/tenants/);
        } catch (error) {
            // May have been denied access or redirected
            const url = this.page.url();
            if (url.includes('/admin/tenants')) {
                // We're on the page but might show access denied
                return;
            }
            throw new Error(`Expected to navigate to admin tenants page but was redirected to: ${url}`);
        }
    }

    /**
     * Page Header and Title
     */
    protected getPageTitle(): Locator {
        return this.page.locator('h1:has-text("Tenant Management")');
    }

    protected getPageDescription(): Locator {
        return this.page.locator('text=View and manage all tenant configurations');
    }

    /**
     * Tenant Count and Refresh
     */
    protected getTenantCount(): Locator {
        return this.page.locator('text=/Total tenants:/');
    }

    protected getRefreshButton(): Locator {
        return this.page.locator('button:has-text("Refresh")');
    }

    /**
     * Loading and Error States
     */
    protected getLoadingSpinner(): Locator {
        return this.page.getByTestId('tenants-loading-spinner');
    }

    protected getErrorAlert(): Locator {
        return this.page.locator('[role="alert"]');
    }

    /**
     * Access Denied Message
     */
    protected getAccessDeniedMessage(): Locator {
        return this.page.locator('text=/you do not have permission/i');
    }

    /**
     * Empty State
     */
    protected getEmptyStateMessage(): Locator {
        return this.page.locator('text=No tenants found');
    }

    /**
     * Tenant Cards
     */
    protected getTenantCards(): Locator {
        return this.page.locator('[data-testid="tenant-card"], .space-y-4 > div.p-6');
    }

    protected getTenantCardByName(appName: string): Locator {
        return this.page.locator(`text=${appName}`).locator('..').locator('..');
    }

    protected getTenantCardByTenantId(tenantId: string): Locator {
        return this.page.locator(`text=${tenantId}`).locator('..').locator('..');
    }

    /**
     * Tenant Card Elements - Generic selectors for first card
     */
    protected getFirstTenantAppName(): Locator {
        return this.getTenantCards().first().locator('h3');
    }

    protected getDefaultBadge(): Locator {
        return this.page.locator('text=Default').first();
    }

    /**
     * Tenant Details Getters
     */
    protected getTenantIdText(tenantId: string): Locator {
        return this.page.locator(`text=${tenantId}`);
    }

    protected getPrimaryDomainText(domain: string): Locator {
        return this.page.locator(`text=${domain}`);
    }

    /**
     * Actions
     */
    async clickRefresh(): Promise<void> {
        await this.getRefreshButton().click();
    }

    async clickEditButtonForFirstTenant<T = TenantEditorModalPage>(
        pageFactory?: (page: Page) => T,
    ): Promise<T> {
        const firstEditButton = this.page.locator('[data-testid^="edit-tenant-"]').first();
        await firstEditButton.click();
        const modal = pageFactory ? pageFactory(this.page) : (new TenantEditorModalPage(this.page) as unknown as T);
        return modal;
    }

    /**
     * Verification Methods
     */
    async verifyPageLoaded(): Promise<void> {
        await expect(this.getPageTitle()).toBeVisible();
        await expect(this.getPageDescription()).toBeVisible();
    }

    async verifyAccessDenied(): Promise<void> {
        await expect(this.getAccessDeniedMessage()).toBeVisible();
    }

    async verifyTenantCount(expectedCount: number): Promise<void> {
        const countText = await this.getTenantCount().textContent();
        expect(countText).toContain(expectedCount.toString());
    }

    async verifyTenantCardVisible(appName: string): Promise<void> {
        await expect(this.getTenantCardByName(appName)).toBeVisible();
    }

    async verifyTenantIdVisible(tenantId: string): Promise<void> {
        await expect(this.getTenantIdText(tenantId)).toBeVisible();
    }

    async verifyPrimaryDomainVisible(domain: string): Promise<void> {
        await expect(this.getPrimaryDomainText(domain)).toBeVisible();
    }

    async verifyDefaultBadgeVisible(): Promise<void> {
        await expect(this.getDefaultBadge()).toBeVisible();
    }

    async verifyLoadingSpinnerVisible(): Promise<void> {
        await expect(this.getLoadingSpinner()).toBeVisible();
    }

    async verifyLoadingSpinnerHidden(): Promise<void> {
        await expect(this.getLoadingSpinner()).not.toBeVisible();
    }

    async verifyEmptyState(): Promise<void> {
        await expect(this.getEmptyStateMessage()).toBeVisible();
    }

    async verifyErrorDisplayed(errorMessage?: string): Promise<void> {
        const alert = this.getErrorAlert();
        await expect(alert).toBeVisible();
        if (errorMessage) {
            await expect(alert).toContainText(errorMessage);
        }
    }

    async verifyPageTitleText(expectedText: string): Promise<void> {
        await expect(this.getPageTitle()).toHaveText(expectedText);
    }

    async verifyPageDescriptionContainsText(text: string): Promise<void> {
        await expect(this.getPageDescription()).toContainText(text);
    }

    async verifyTenantCountVisible(): Promise<void> {
        await expect(this.getTenantCount()).toBeVisible();
    }

    async verifyTenantCountContainsText(text: string): Promise<void> {
        await expect(this.getTenantCount()).toContainText(text);
    }

    async verifyRefreshButtonVisible(): Promise<void> {
        await expect(this.getRefreshButton()).toBeVisible();
    }

    async verifyRefreshButtonEnabled(): Promise<void> {
        await expect(this.getRefreshButton()).toBeEnabled();
    }

    async getDefaultBadgeCount(): Promise<number> {
        return await this.getDefaultBadge().count();
    }

    /**
     * Get first tenant card text content
     */
    async getFirstTenantCardText(): Promise<string | null> {
        return await this.getTenantCards().first().textContent();
    }

    /**
     * Verify first tenant app name is visible
     */
    async verifyFirstTenantAppNameVisible(): Promise<void> {
        await expect(this.getFirstTenantAppName()).toBeVisible();
    }

    /**
     * Get first tenant app name text
     */
    async getFirstTenantAppNameText(): Promise<string | null> {
        return await this.getFirstTenantAppName().textContent();
    }

    /**
     * Extract tenant data from a card
     */
    async extractTenantData(appName: string): Promise<{
        appName: string;
        tenantId: string;
        isDefault: boolean;
        primaryDomain: string | null;
    }> {
        const card = this.getTenantCardByName(appName);
        await expect(card).toBeVisible();

        const cardText = await card.textContent();
        if (!cardText) {
            throw new Error('Could not extract card text');
        }

        // Extract tenant ID
        const tenantIdMatch = cardText.match(/Tenant ID:\s*([a-z0-9-]+)/);
        const tenantId = tenantIdMatch ? tenantIdMatch[1] : '';

        // Check if default badge exists
        const defaultBadge = card.locator('text=Default');
        const isDefault = await defaultBadge.count() > 0;

        // Extract primary domain
        const primaryDomainMatch = cardText.match(/Primary Domain:\s*([^\s]+)/);
        const primaryDomain = primaryDomainMatch ? primaryDomainMatch[1] : null;

        return {
            appName,
            tenantId,
            isDefault,
            primaryDomain,
        };
    }

    /**
     * Count visible tenant cards
     */
    async countTenantCards(): Promise<number> {
        return await this.getTenantCards().count();
    }

    /**
     * Wait for page to be ready
     */
    async waitForPageReady(): Promise<void> {
        await this.page.waitForLoadState('networkidle');
        await expect(this.getPageTitle()).toBeVisible();
    }

    /**
     * Wait for tenants to load
     */
    async waitForTenantsLoaded(): Promise<void> {
        // Wait for loading spinner to disappear
        await this.page.waitForLoadState('networkidle');

        // Either we have tenant cards or an empty state
        await Promise.race([
            this.getTenantCards().first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
            this.getEmptyStateMessage().waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
        ]);
    }
}
