import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the Domain Management page.
 * Provides methods for interacting with tenant domain settings (admin-only).
 */
export class DomainManagementPage extends BasePage {
    readonly url = '/settings/tenant/domains';

    constructor(page: Page) {
        super(page);
    }

    /**
     * Navigate to domain management page
     */
    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });

        // Check if we successfully navigated
        try {
            await expect(this.page).toHaveURL(/\/settings\/tenant\/domains/);
        } catch (error) {
            // May have been denied access
            const url = this.page.url();
            if (url.includes('/settings/tenant/domains')) {
                // We're on the page but might show access denied
                return;
            }
            throw new Error(`Expected to navigate to domain management page but was redirected to: ${url}`);
        }
    }

    /**
     * Access Denied Message
     */
    protected getAccessDeniedMessage(): Locator {
        return this.page.locator('text=/you do not have permission/i');
    }

    /**
     * Domain List Locators
     */
    protected getDomainList(): Locator {
        return this.page.locator('[data-testid="domain-list"]');
    }

    protected getDomainItem(domain: string): Locator {
        return this.page.locator(`[data-testid="domain-item-${domain}"]`);
    }

    protected getPrimaryDomainBadge(): Locator {
        return this.page.locator('[data-testid="primary-domain-badge"]');
    }

    /**
     * Add Domain Form Locators
     */
    protected getAddDomainButton(): Locator {
        return this.page.locator('[data-testid="add-domain-button"]');
    }

    protected getNewDomainInput(): Locator {
        return this.page.locator('[data-testid="new-domain-input"]');
    }

    protected getSubmitDomainButton(): Locator {
        return this.page.locator('[data-testid="submit-domain-button"]');
    }

    protected getCancelDomainButton(): Locator {
        return this.page.locator('[data-testid="cancel-domain-button"]');
    }

    /**
     * DNS Instructions Locators
     */
    protected getDnsInstructions(): Locator {
        return this.page.locator('[data-testid="dns-instructions"]');
    }

    protected getCopyDnsButton(): Locator {
        return this.page.locator('[data-testid="copy-dns-button"]');
    }

    /**
     * Success/Error Messages
     */
    protected getSuccessMessage(): Locator {
        return this.page.locator('text=/domain.*added successfully/i');
    }

    protected getNotImplementedMessage(): Locator {
        return this.page.locator('text=/domain addition not yet implemented/i');
    }

    protected getErrorMessage(): Locator {
        return this.page.locator('[data-testid="error-message"]');
    }

    /**
     * Actions
     */
    async clickAddDomain(): Promise<void> {
        await this.getAddDomainButton().click();
    }

    async fillNewDomain(domain: string): Promise<void> {
        await this.getNewDomainInput().fill(domain);
    }

    async submitNewDomain(): Promise<void> {
        await this.getSubmitDomainButton().click();
    }

    async cancelAddDomain(): Promise<void> {
        await this.getCancelDomainButton().click();
    }

    async copyDnsInstructions(): Promise<void> {
        await this.getCopyDnsButton().click();
    }

    /**
     * Verification Methods
     */
    async verifyNewDomainInputVisible(): Promise<void> {
        await expect(this.getNewDomainInput()).toBeVisible();
    }

    async verifyNewDomainInputValue(value: string): Promise<void> {
        await expect(this.getNewDomainInput()).toHaveValue(value);
    }

    async verifyCopyDnsButtonVisible(): Promise<void> {
        await expect(this.getCopyDnsButton()).toBeVisible();
    }

    async verifyDnsInstructionsContains(text: string): Promise<void> {
        await expect(this.getDnsInstructions()).toContainText(text);
    }

    async verifyDnsInstructionsShowsCname(): Promise<void> {
        const dnsSection = this.getDnsInstructions();
        await expect(dnsSection.locator('text=/CNAME/i').first()).toBeVisible();
    }

    async verifyDnsInstructionsShowsPrimaryDomain(): Promise<void> {
        const dnsSection = this.getDnsInstructions();
        await expect(dnsSection.locator('text=/localhost/i')).toBeVisible();
    }

    async verifyAccessDenied(): Promise<void> {
        await expect(this.getAccessDeniedMessage()).toBeVisible();
    }

    async verifyDomainListVisible(): Promise<void> {
        await expect(this.getDomainList()).toBeVisible();
    }

    async verifyDomainExists(domain: string): Promise<void> {
        await expect(this.getDomainItem(domain)).toBeVisible();
    }

    async verifyDomainCount(count: number): Promise<void> {
        const items = this.page.locator('[data-testid^="domain-item-"]');
        await expect(items).toHaveCount(count);
    }

    async verifyPrimaryDomain(domain: string): Promise<void> {
        const domainItem = this.getDomainItem(domain);
        await expect(domainItem.locator('[data-testid="primary-domain-badge"]')).toBeVisible();
    }

    async verifyAddDomainFormVisible(): Promise<void> {
        await expect(this.getNewDomainInput()).toBeVisible();
        await expect(this.getSubmitDomainButton()).toBeVisible();
    }

    async verifyAddDomainFormHidden(): Promise<void> {
        await expect(this.getNewDomainInput()).not.toBeVisible();
    }

    async verifyDnsInstructionsVisible(): Promise<void> {
        await expect(this.getDnsInstructions()).toBeVisible();
    }

    async verifySuccessMessage(): Promise<void> {
        await expect(this.getSuccessMessage()).toBeVisible();
    }

    async verifyNotImplementedMessage(): Promise<void> {
        await expect(this.getNotImplementedMessage()).toBeVisible();
    }

    /**
     * Wait for page to be ready
     */
    async waitForPageReady(): Promise<void> {
        // Wait for the main heading to be visible
        await this.page.locator('text=Domain Management').waitFor({ state: 'visible' });
    }
}
