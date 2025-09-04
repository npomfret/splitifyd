import { pageTest as test, expect } from '../../../fixtures/page-fixtures';

test.describe('SEO Validation', () => {
    test('should have proper SEO elements on homepage', async ({ page, homepagePage }) => {
        await homepagePage.navigate();
        
        // Title validation
        const homeTitle = await page.title();
        expect(homeTitle).toContain('Splitifyd');
        expect(homeTitle.length).toBeGreaterThan(10);
        expect(homeTitle.length).toBeLessThan(60);

        // Meta description validation
        const metaDescription = await page.getAttribute('meta[name="description"]', 'content');
        expect(metaDescription).toBeTruthy();
        expect(metaDescription!.length).toBeGreaterThan(120);
        expect(metaDescription!.length).toBeLessThan(160);

        // Viewport meta tag
        const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content');
        expect(viewportMeta).toContain('width=device-width');
        expect(viewportMeta).toContain('initial-scale=1');

        // Canonical URL
        const canonicalLink = page.locator('link[rel="canonical"]');
        await expect(canonicalLink).toBeAttached();

        // Language attribute
        const htmlLang = await page.getAttribute('html', 'lang');
        expect(htmlLang).toBe('en');
    });

    test('should have proper SEO elements on pricing page', async ({ page, pricingPage }) => {
        await pricingPage.navigate();
        
        // Title validation
        const pricingTitle = await page.title();
        expect(pricingTitle).toContain('Splitifyd');
        expect(pricingTitle).toContain('Pricing');
        expect(pricingTitle.length).toBeLessThan(60);

        // Meta description validation
        const metaDescription = await page.getAttribute('meta[name="description"]', 'content');
        expect(metaDescription).toBeTruthy();
        expect(metaDescription!.length).toBeGreaterThan(50);

        // Heading structure validation
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBe(1);

        // Proper heading hierarchy (h2 should not come before h1)
        const firstHeading = page.locator('h1, h2, h3').first();
        const tagName = await firstHeading.evaluate(el => el.tagName.toLowerCase());
        expect(tagName).toBe('h1');
    });
});
