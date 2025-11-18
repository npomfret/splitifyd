import AxeBuilder from '@axe-core/playwright';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';
import { EMULATOR_URL, waitForApp } from '../../helpers';

test.describe('Site Quality - Accessibility', () => {
    test('should not have critical accessibility issues', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await page.goto(EMULATOR_URL);
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
        const { page } = await newEmptyBrowser();

        // Part 1: Homepage SEO validation
        await page.goto(EMULATOR_URL);

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
        await page.goto(`${EMULATOR_URL}/pricing`);
        await waitForApp(page);

        // Wait for the page to render and check if it's a 404
        await page.waitForSelector('h1', { timeout: 5000 });
        const h1Text = await page.locator('h1').first().textContent();
        const is404 = h1Text?.includes('404') || false;

        if (!is404) {
            await waitForApp(page); // Wait for React to mount and set meta tags

            const appName = await page
                .request
                .get(`${EMULATOR_URL}/api/config`)
                .then((response) => response.json())
                .then((config) => config?.tenant?.branding?.appName ?? 'Splitifyd');

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
