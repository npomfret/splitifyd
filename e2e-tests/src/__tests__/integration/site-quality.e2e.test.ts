import AxeBuilder from '@axe-core/playwright';
import { simpleTest as test, expect } from '../../fixtures/simple-test.fixture';
import { HomepagePage, PricingPage } from '../../pages';
import { waitForApp } from '../../helpers';

test.describe('Site Quality - Accessibility', () => {
    test('should not have critical accessibility issues', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigate();
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
        const homepagePage = new HomepagePage(page);
        const pricingPage = new PricingPage(page);

        // Part 1: Homepage SEO validation
        await homepagePage.navigate();

        // Title validation
        const homeTitle = await page.title();
        expect(homeTitle).toContain('Splitifyd');
        expect(homeTitle.length).toBeGreaterThan(5);
        expect(homeTitle.length).toBeLessThan(60);

        // Meta description validation
        const metaDescription = await page.getAttribute('meta[name="description"]', 'content');
        expect(metaDescription).toBeTruthy();
        expect(metaDescription!.length).toBeGreaterThan(120);
        expect(metaDescription!.length).toBeLessThan(200);

        // Viewport meta tag
        const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content');
        expect(viewportMeta).toContain('width=device-width');
        expect(viewportMeta).toContain('initial-scale=1');

        // Language attribute
        const htmlLang = await page.getAttribute('html', 'lang');
        expect(htmlLang).toBe('en');

        // Part 2: Pricing page SEO validation
        await pricingPage.navigate();

        // Title validation
        const pricingTitle = await page.title();
        expect(pricingTitle).toContain('Splitifyd');
        expect(pricingTitle.length).toBeLessThan(60);

        // Meta description validation
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
    });
});
