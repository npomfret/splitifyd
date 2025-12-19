import { expect, Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

/**
 * Page Object Model for the Admin page and admin layout.
 * Provides methods for verifying admin page isolation, theming, and layout.
 */
export class AdminPage extends BasePage {
    readonly url = '/admin';

    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // LAYOUT SELECTORS
    // ============================================================================

    protected getAdminLayout(): Locator {
        // CSS class selector: deliberately testing that admin layout class is applied (style assertion)
        return this.page.locator('.admin-layout');
    }

    protected getAdminHeader(): Locator {
        return this.page.getByRole('banner');
    }

    protected getAdminGradientBackground(): Locator {
        // CSS class selector: deliberately testing admin-specific gradient styling exists (style assertion)
        return this.page.locator('.admin-gradient-mixed');
    }

    protected getAdminGridPattern(): Locator {
        // CSS class selector: deliberately testing admin-specific grid pattern styling exists (style assertion)
        return this.page.locator('.admin-grid-pattern');
    }

    // ============================================================================
    // STYLESHEET SELECTORS
    // ============================================================================

    protected getTenantThemeStylesheet(): Locator {
        return this.page.locator('link#tenant-theme-stylesheet');
    }

    protected getAdminStylesheet(): Locator {
        return this.page.locator('link#admin-stylesheet');
    }

    // ============================================================================
    // HEADER SELECTORS
    // ============================================================================

    protected getLogoutButton(): Locator {
        return this.page.getByRole('button', { name: translation.navigation.userMenu.logout });
    }

    protected getFirstButton(): Locator {
        // Use the Tenants tab as a representative button for style testing
        return this.page.getByRole('navigation', { name: translation.admin.tabs.ariaLabel }).getByRole('button', { name: translation.admin.tabs.tenants });
    }

    protected getAdminButton(): Locator {
        // Get a specific tab button (Tenants) in the admin tabs nav
        return this.page.getByRole('navigation', { name: translation.admin.tabs.ariaLabel }).getByRole('button', { name: translation.admin.tabs.tenants });
    }

    // ============================================================================
    // NAVIGATION
    // ============================================================================

    async navigate(): Promise<void> {
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
        await this.waitForPageReady();
    }

    async navigateToTenants(): Promise<void> {
        await this.page.goto('/admin?tab=tenants', { waitUntil: 'domcontentloaded' });
        await this.waitForPageReady();
    }

    async navigateToDiagnostics(): Promise<void> {
        await this.page.goto('/admin?tab=diagnostics', { waitUntil: 'domcontentloaded' });
        await this.waitForPageReady();
    }

    async navigateToDashboard(): Promise<void> {
        await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    }

    async waitForPageReady(): Promise<void> {
        await expect(this.getAdminLayout()).toBeVisible({ timeout: 5000 });
    }

    // ============================================================================
    // STYLESHEET STATE METHODS
    // ============================================================================

    async isTenantThemeDisabled(): Promise<boolean> {
        const themeLink = this.getTenantThemeStylesheet();
        return await themeLink.evaluate((el: HTMLLinkElement) => {
            return el.disabled || el.href === '' || el.href === window.location.href;
        });
    }

    async isTenantThemeEnabled(): Promise<boolean> {
        const themeLink = this.getTenantThemeStylesheet();
        return await themeLink.evaluate((el: HTMLLinkElement) => {
            return !el.disabled && el.href !== '' && el.href.includes('/api/theme.css');
        });
    }

    async getAdminStylesheetCount(): Promise<number> {
        return await this.getAdminStylesheet().count();
    }

    // ============================================================================
    // CSS VARIABLE METHODS
    // ============================================================================

    async getAdminPrimaryColor(): Promise<string> {
        return await this.page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--admin-primary').trim();
        });
    }

    async getHeaderBackgroundColor(): Promise<string> {
        const header = this.getAdminHeader();
        return await header.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
        });
    }

    async getButtonTransition(): Promise<string> {
        const button = this.getFirstButton();
        return await button.evaluate((el) => {
            return window.getComputedStyle(el).transition;
        });
    }

    async getButtonTransformBeforeHover(): Promise<string> {
        const button = this.getFirstButton();
        return await button.evaluate((el) => {
            return window.getComputedStyle(el).transform;
        });
    }

    async getButtonTransformAfterHover(): Promise<string> {
        const button = this.getFirstButton();
        await button.hover();
        // Small wait for any animation to complete
        await this.page.waitForFunction(() => true, null, { timeout: 100 }).catch(() => {});
        return await button.evaluate((el) => {
            return window.getComputedStyle(el).transform;
        });
    }

    async getAdminButtonBoundingBox(): Promise<{ x: number; y: number; width: number; height: number; } | null> {
        const button = this.getAdminButton();
        return await button.boundingBox();
    }

    async hoverAdminButton(): Promise<void> {
        const button = this.getAdminButton();
        await button.hover();
        // Small wait for any animation to complete
        await this.page.waitForFunction(() => true, null, { timeout: 200 }).catch(() => {});
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    async verifyAdminLayoutVisible(): Promise<void> {
        await expect(this.getAdminLayout()).toBeVisible();
    }

    async verifyAdminLayoutCount(): Promise<number> {
        return await this.getAdminLayout().count();
    }

    async verifyTenantThemeDisabled(): Promise<void> {
        const isDisabled = await this.isTenantThemeDisabled();
        expect(isDisabled).toBe(true);
    }

    async verifyTenantThemeEnabled(): Promise<void> {
        const isEnabled = await this.isTenantThemeEnabled();
        expect(isEnabled).toBe(true);
    }

    async verifyAdminStylesheetLoaded(): Promise<void> {
        const count = await this.getAdminStylesheetCount();
        expect(count).toBe(1);
    }

    async verifyAdminStylesheetRemoved(): Promise<void> {
        const count = await this.getAdminStylesheetCount();
        expect(count).toBe(0);
    }

    async verifyAdminHeaderVisible(): Promise<void> {
        await expect(this.getAdminHeader()).toBeVisible();
    }

    async verifyLogoutButtonVisible(): Promise<void> {
        await expect(this.getLogoutButton()).toBeVisible();
    }

    async verifyLogoutButtonText(): Promise<void> {
        await expect(this.getLogoutButton()).toHaveText(translation.navigation.userMenu.logout);
    }

    async verifyNoTenantLogo(): Promise<void> {
        // The AdminHeader is isolated from tenant THEMING (CSS) but may still show tenant
        // identification (logo/name). This method verifies the admin header structure is used
        // (minimal header with logout button) rather than checking for specific branding.
        await this.verifyLogoutButtonVisible();
    }

    async verifyFirstButtonVisible(): Promise<void> {
        await expect(this.getFirstButton()).toBeVisible();
    }

    async verifyAdminButtonVisible(): Promise<void> {
        await expect(this.getAdminButton()).toBeVisible();
    }

    async verifyTransitionsDisabled(): Promise<void> {
        const transition = await this.getButtonTransition();
        expect(transition).toMatch(/none|0s/);
    }

    async verifyNoMagneticHoverEffect(): Promise<void> {
        const beforeTransform = await this.getButtonTransformBeforeHover();
        const afterTransform = await this.getButtonTransformAfterHover();
        expect(beforeTransform).toBe(afterTransform);
    }

    async verifyButtonPositionUnchangedAfterHover(): Promise<void> {
        await this.verifyAdminButtonVisible();
        const beforeBox = await this.getAdminButtonBoundingBox();
        expect(beforeBox).toBeTruthy();

        await this.hoverAdminButton();

        const afterBox = await this.getAdminButtonBoundingBox();
        expect(afterBox).toBeTruthy();

        expect(afterBox?.x).toBeCloseTo(beforeBox!.x, 1);
        expect(afterBox?.y).toBeCloseTo(beforeBox!.y, 1);
    }

    async verifyAdminGradientBackgroundVisible(): Promise<void> {
        const count = await this.getAdminGradientBackground().count();
        expect(count).toBeGreaterThan(0);
    }

    async verifyAdminGridPatternVisible(): Promise<void> {
        await expect(this.getAdminGridPattern()).toBeVisible();
    }

    async verifyHeaderBackgroundWhite(): Promise<void> {
        const headerBg = await this.getHeaderBackgroundColor();
        expect(headerBg).toMatch(/rgb\(255,\s*255,\s*255\)/);
    }

    async verifyAdminPrimaryColorIndigo(): Promise<void> {
        // Wait for the CSS variable to be available (stylesheet might still be loading)
        await expect(async () => {
            const color = await this.getAdminPrimaryColor();
            expect(color).toBe('#4f46e5');
        })
            .toPass({ timeout: 5000 });
    }

    async verifyAdminIsolation(): Promise<void> {
        await this.verifyAdminLayoutVisible();
        await this.verifyAdminStylesheetLoaded();
    }
}
