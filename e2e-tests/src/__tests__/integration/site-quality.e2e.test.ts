import AxeBuilder from '@axe-core/playwright';
import { FooterComponent } from '@billsplit-wl/test-support';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';
import { waitForApp } from '../../helpers';

test.describe('Site Quality - Accessibility', () => {
    test('should not have critical accessibility issues', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        // Navigate from login to home page via header logo
        await loginPage.navigateToHome();
        await waitForApp(page);

        // Run basic accessibility scan
        const accessibilityScanResults = await new AxeBuilder({ page })
            .disableRules(['color-contrast']) // Disable while design is in flux
            .analyze();

        // Only fail on critical violations
        const criticalViolations = accessibilityScanResults.violations.filter((v) => v.impact === 'critical');
        expect(criticalViolations).toHaveLength(0);
    });
});

test.describe('Site Quality - SEO', () => {
    test('should have proper SEO elements across all pages', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();

        // Part 1: Homepage SEO validation - navigate via header logo
        await loginPage.navigateToHome();

        // Title validation
        const homeTitle = await page.title();
        expect(homeTitle.length).toBeGreaterThan(1);
        expect(homeTitle.length).toBeLessThan(60);

        // Meta description validation
        const metaDescription = await page.getAttribute('meta[name="description"]', 'content');
        expect(metaDescription).toBeTruthy();
        expect(metaDescription!.length).toBeGreaterThan(20);
        expect(metaDescription!.length).toBeLessThan(200);

        // Viewport meta tag
        const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content');
        expect(viewportMeta).toContain('width=device-width');
        expect(viewportMeta).toContain('initial-scale=1');

        // Language attribute
        const htmlLang = await page.getAttribute('html', 'lang');
        expect(htmlLang).toBe('en');

        // Part 2: Pricing page SEO validation (skip if pricing page feature is disabled)
        // Check if pricing link is available in footer
        const footer = new FooterComponent(page);
        const hasPricingLink = await footer.isPricingLinkVisible();

        if (hasPricingLink) {
            // Navigate to pricing via footer link
            await footer.clickPricingLink();
            await waitForApp(page);

            // Wait for the page to render
            await page.waitForSelector('h1', { timeout: 5000 });

            // Get app name from page context (already loaded)
            const appName = await page.evaluate(() => {
                const configScript = document.querySelector('script[data-config]');
                if (configScript) {
                    const config = JSON.parse(configScript.getAttribute('data-config') || '{}');
                    return config?.tenant?.branding?.appName ?? 'Splitifyd';
                }
                return 'Splitifyd';
            });

            // Title validation
            const pricingTitle = await page.title();
            expect(pricingTitle).toContain(appName);
            expect(pricingTitle.length).toBeLessThan(60);

            // Meta description validation - wait for it to be added by React
            await page.waitForSelector('meta[name="description"]', { state: 'attached', timeout: 5000 });
            const pricingMetaDescription = await page.getAttribute('meta[name="description"]', 'content');
            expect(pricingMetaDescription).toBeTruthy();
            expect(pricingMetaDescription!.length).toBeGreaterThan(50);

            // Heading structure validation
            const h1Count = await page.locator('h1').count();
            expect(h1Count).toBe(1);

            // Proper heading hierarchy (h2 should not come before h1)
            const firstHeading = page.locator('h1, h2, h3').first();
            const tagName = await firstHeading.evaluate((el) => el.tagName.toLowerCase());
            expect(tagName).toBe('h1');
        }
    });
});
