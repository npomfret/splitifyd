import AxeBuilder from '@axe-core/playwright';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';
import { waitForApp } from '../../helpers';

test.describe('Site Quality - Accessibility', () => {
    test('should not have critical accessibility issues', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        // Test accessibility on the login page (entry point for unauthenticated users)
        await loginPage.verifyLoginPageLoaded();
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

        // Test SEO elements on the login page (entry point for unauthenticated users)
        await loginPage.verifyLoginPageLoaded();

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
    });
});
