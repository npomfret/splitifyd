import { expect, Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { TenantEditorModalPage } from './TenantEditorModalPage';

const translation = translationEn;

/**
 * Page Object Model for the Admin Tenants page.
 * Provides methods for viewing and managing all tenant configurations (system admin only).
 */
export class AdminTenantsPage extends BasePage {
    readonly url = '/admin?tab=tenants';

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
            await expect(this.page).toHaveURL(/\/admin(\?tab=tenants)?/);
        } catch (error) {
            // May have been denied access or redirected
            const url = this.page.url();
            if (url.includes('/admin')) {
                // We're on the page but might show access denied
                return;
            }
            throw new Error(`Expected to navigate to admin tenants page but was redirected to: ${url}`);
        }
    }

    /**
     * Page Header Elements
     * Note: The tenants tab is now part of the AdminPage tabbed interface,
     * so there's no dedicated page title. We use the Create button as a characteristic element.
     */
    protected getCreateTenantButton(): Locator {
        return this.page.getByRole('button', { name: translation.admin.tenants.actions.create });
    }

    /**
     * Tenant Count and Refresh
     */
    protected getTenantCount(): Locator {
        return this.page.getByText(translation.admin.tenants.summary.total, { exact: false });
    }

    protected getRefreshButton(): Locator {
        return this.page.getByRole('button', { name: translation.common.refresh });
    }

    /**
     * Loading and Error States
     */
    protected getLoadingSpinner(): Locator {
        return this.page.getByRole('status');
    }

    protected getErrorAlert(): Locator {
        return this.page.locator('[role="alert"]');
    }

    /**
     * Access Denied Message
     */
    protected getAccessDeniedMessage(): Locator {
        // Admin pages use hardcoded English - not translated
        return this.page.getByText(/you do not have permission/i);
    }

    /**
     * Empty State
     */
    protected getEmptyStateMessage(): Locator {
        return this.page.getByText(translation.admin.tenants.emptyState);
    }

    /**
     * Get tenant card headings - used for counting cards and verifying app names
     * Each card has exactly one h3 with the tenant's app name
     */
    protected getTenantCardHeadings(): Locator {
        return this.page.getByRole('heading', { level: 3 });
    }

    /**
     * Tenant Cards - for counting purposes, we count h3 headings
     */
    protected getTenantCards(): Locator {
        return this.getTenantCardHeadings();
    }

    /**
     * Get a tenant card heading by app name
     */
    protected getTenantCardByName(appName: string): Locator {
        return this.page.getByRole('heading', { name: appName, level: 3 });
    }

    /**
     * Get the full card container for a tenant by app name
     * Uses semantic region role - cards have ariaLabel set to app name
     */
    protected getTenantCardContainerByName(appName: string): Locator {
        return this.page.getByRole('region', { name: appName });
    }

    protected getTenantCardByTenantId(tenantId: string): Locator {
        return this.page.getByText(`Tenant ID: ${tenantId}`);
    }

    /**
     * Tenant Card Elements - Generic selectors for first card
     * .first() is intentional: tests need first tenant in list order
     */
    protected getFirstTenantAppName(): Locator {
        // .first(): Deliberately select first tenant for ordered list operations
        return this.getTenantCards().first();
    }

    protected getDefaultBadge(): Locator {
        // .first(): Multiple tenants may have default badge; first in DOM order
        return this.page.getByText(translation.admin.tenants.status.default).first();
    }

    /**
     * Tenant Details Getters
     */
    protected getTenantIdText(tenantId: string): Locator {
        return this.page.getByText(tenantId);
    }

    protected getPrimaryDomainText(domain: string): Locator {
        return this.page.getByText(domain);
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
        // .first(): Deliberately select first tenant for ordered list operations
        const firstTenantHeading = this.getTenantCards().first();
        const appName = await firstTenantHeading.textContent();
        if (!appName) {
            throw new Error('Could not get first tenant app name');
        }
        // Use the scoped edit button with proper aria-label
        const editButton = this.page.getByRole('button', { name: `${translation.common.edit} ${appName.trim()}` });
        await editButton.click();
        const modal = pageFactory ? pageFactory(this.page) : (new TenantEditorModalPage(this.page) as unknown as T);
        return modal;
    }

    async clickEditButtonForTenant<T = TenantEditorModalPage>(
        appName: string,
        pageFactory?: (page: Page) => T,
    ): Promise<T> {
        // Edit button has aria-label="Edit {appName}"
        const editButton = this.page.getByRole('button', { name: `${translation.common.edit} ${appName}` });
        await editButton.click();
        const modal = pageFactory ? pageFactory(this.page) : (new TenantEditorModalPage(this.page) as unknown as T);
        return modal;
    }

    /**
     * Verification Methods
     */
    async verifyPageLoaded(): Promise<void> {
        // The tenants tab is loaded when we see the create button and tenant count
        await expect(this.getCreateTenantButton()).toBeVisible();
        await expect(this.getTenantCount()).toBeVisible();
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

    async verifyPageTitleText(_expectedText: string): Promise<void> {
        // Deprecated: The tabbed interface no longer has a dedicated page title.
        // Instead verify the tenants tab is active (using semantic selector)
        await expect(this.page.getByRole('button', { name: translation.admin.tabs.tenants })).toBeVisible();
    }

    async verifyPageDescriptionContainsText(_text: string): Promise<void> {
        // Deprecated: The tabbed interface no longer has a page description.
        // Instead verify the tenant count is visible as it indicates the tab content is loaded
        await expect(this.getTenantCount()).toBeVisible();
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
     * Get first tenant card container (for full text extraction)
     * Finds the region (Card with ariaLabel) that contains the first tenant heading
     */
    protected getFirstTenantCardContainer(): Locator {
        // .first() x2: First tenant heading, then first matching region container
        // Card components with ariaLabel render as role="region"
        return this.page.getByRole('region').filter({ has: this.getTenantCards().first() }).first();
    }

    /**
     * Get first tenant card text content
     */
    async getFirstTenantCardText(): Promise<string | null> {
        return await this.getFirstTenantCardContainer().textContent();
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
    }> {
        // Use the container method to get full card content
        const cardContainer = this.getTenantCardContainerByName(appName);
        await expect(cardContainer).toBeVisible();

        const cardText = await cardContainer.textContent();
        if (!cardText) {
            throw new Error('Could not extract card text');
        }

        // Extract tenant ID using the translated label
        const tenantIdLabel = translation.admin.tenants.details.tenantId.replace(':', '');
        const tenantIdMatch = cardText.match(new RegExp(`${tenantIdLabel}:\\s*([a-z0-9-]+)`));
        const tenantId = tenantIdMatch ? tenantIdMatch[1] : '';

        // Check if default badge exists within this card container
        const defaultBadge = cardContainer.getByText(translation.admin.tenants.status.default);
        const isDefault = await defaultBadge.count() > 0;

        return {
            appName,
            tenantId,
            isDefault,
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
        // Wait for characteristic elements of the tenants tab to be visible
        await expect(this.getCreateTenantButton()).toBeVisible();
    }

    /**
     * Wait for tenants to load
     */
    async waitForTenantsLoaded(): Promise<void> {
        // Wait for loading spinner to disappear (don't use networkidle as SSE may keep connection open)
        await expect(this.getLoadingSpinner()).not.toBeVisible({ timeout: 5000 });

        // Either we have tenant cards or an empty state
        // .first(): Verify at least one tenant card is visible
        await Promise.race([
            this.getTenantCards().first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
            this.getEmptyStateMessage().waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
        ]);
    }
}
