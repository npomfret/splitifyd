import { simpleTest, expect } from '../../fixtures';
import { waitForApp } from '../../helpers';
import { TIMEOUTS } from '../../config/timeouts';
import { RegisterPage, LoginPage, HomepagePage, PricingPage } from '../../pages';

// NOTE: Simple load time testing moved to CI performance budgets
simpleTest.describe('Performance Monitoring E2E', () => {
    simpleTest('should handle login and registration form interactions correctly on slow network', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const context = page.context();
        const loginPage = new LoginPage(page);
        // Simulate slow 3G network conditions
        await context.route('**/*', (route) => {
            setTimeout(() => route.continue(), TIMEOUTS.QUICK / 5);
        });

        await loginPage.navigate();

        // Page should still load and be functional on slow network
        await waitForApp(page);
        await expect(loginPage.getHeading('Sign In')).toBeVisible();

        // Test comprehensive form functionality under slow network conditions
        const emailInput = loginPage.getEmailInput();
        const passwordInput = loginPage.getPasswordInput();
        const submitButton = loginPage.getSubmitButton();

        // Test email input
        await loginPage.fillPreactInput(emailInput, 'test@example.com');
        await expect(emailInput).toHaveValue('test@example.com');

        // Test password input
        await loginPage.fillPreactInput(passwordInput, 'TestPassword123');
        await expect(passwordInput).toHaveValue('TestPassword123');

        // Test form validation - clear email and check submit is disabled
        await loginPage.fillPreactInput(emailInput, '');
        await expect(submitButton).toBeDisabled();

        // Re-fill email
        await loginPage.fillPreactInput(emailInput, 'test@example.com');
        await expect(submitButton).toBeEnabled();

        // Test navigation links still work
        await loginPage.clickSignUp();

        // Should navigate to register page even with slow network
        await expect(page).toHaveURL(/\/register/);
        const registerPage = new RegisterPage(page);
        await expect(registerPage.getHeading('Create Account')).toBeVisible();

        // No console errors
        // Console errors are automatically captured by the test framework
    });

    simpleTest('should meet Web Core Vitals metrics on homepage', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigate();
        await waitForApp(page);

        // Measure performance metrics using Navigation Timing API
        const performanceMetrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType('paint');

            return {
                // Time to First Byte
                ttfb: navigation.responseStart - navigation.fetchStart,
                // DOM Content Loaded
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
                // First Contentful Paint
                fcp: paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0,
                // Load Complete
                loadComplete: navigation.loadEventEnd - navigation.fetchStart,
                // DNS Lookup Time
                dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
                // Connection Time
                connectionTime: navigation.connectEnd - navigation.connectStart,
            };
        });

        // Web Core Vitals thresholds
        expect(performanceMetrics.ttfb).toBeLessThan(600); // TTFB under 600ms is good
        expect(performanceMetrics.fcp).toBeLessThan(1800); // FCP under 1.8s is good
        expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // DOM ready under 2s
        expect(performanceMetrics.loadComplete).toBeLessThan(3000); // Full load under 3s

        // Network performance
        expect(performanceMetrics.dnsTime).toBeLessThan(100); // DNS should be fast locally
        expect(performanceMetrics.connectionTime).toBeLessThan(100); // Connection fast locally
    });

    simpleTest('should monitor resource loading across main pages', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        const loginPage = new LoginPage(page);
        const registerPage = new RegisterPage(page);
        const pricingPage = new PricingPage(page);
        const failedRequests: string[] = [];
        const resourceTypes: Map<string, number> = new Map();

        // Helper function to categorize resource types
        const getResourceType = (url: string) => {
            if (url.includes('.js')) return 'javascript';
            if (url.includes('.css')) return 'css';
            if (url.includes('.html') || url.endsWith('/')) return 'html';
            if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return 'image';
            return 'other';
        };

        // Monitor all requests and categorize by type
        page.on('response', (response) => {
            const url = response.url();
            const status = response.status();

            // Track resource types
            const resourceType = getResourceType(url);
            resourceTypes.set(resourceType, (resourceTypes.get(resourceType) || 0) + 1);

            // Track failed requests
            if (status >= 400) {
                failedRequests.push(`${status} - ${url}`);
            }

            // No 4xx or 5xx errors should occur
            expect(status).toBeLessThan(400);
        });

        // Visit all main pages
        await homepagePage.navigate();
        await page.waitForLoadState('networkidle');

        await loginPage.navigate();
        await page.waitForLoadState('networkidle');

        await registerPage.navigate();
        await page.waitForLoadState('networkidle');

        await pricingPage.navigate();
        await page.waitForLoadState('networkidle');

        // Verify no failed requests
        expect(failedRequests).toHaveLength(0);

        // Verify reasonable resource counts
        expect(resourceTypes.get('html') || 0).toBeGreaterThan(0);
        expect(resourceTypes.get('javascript') || 0).toBeGreaterThan(0);
        expect(resourceTypes.get('css') || 0).toBeGreaterThan(0);
    });
});
